{
    outputs = { self, ... }:
    let
        # Config files linked individually such that pi is still able to write in others.
        configFiles = [
            ".pi-lens/config.json"
            ".pi/agent/agents/reviewer-alt.md"
            ".pi/agent/extensions/pi-footer.json"
            ".pi/agent/extensions/random-hue.ts"
            ".pi/agent/keybindings.json"
            ".pi/agent/random-hue/config.json"
            ".pi/agent/skills/code-review/SKILL.md"
            ".pi/agent/themes/purple.json"
            ".pi/web-search.json"
        ];

        # Settings file is merged into the user's existing one.
        settingsFile = ".pi/agent/settings.json";

        # Common CLI tools agents use, scoped to pi only.
        extraPackages = pkgs: [
            pkgs.fd
            pkgs.jq
            pkgs.nodejs
            pkgs.python3
            pkgs.ripgrep
            pkgs.tree
            pkgs.yq
        ];

        # Pi writes settings itself, so keep the merged file writable rather than
        # linking it into the read-only Nix store.
        mergeSettingsScript = { lib, pkgs, home }: ''
                (
                    set -e
                    umask 077
                    target=${lib.escapeShellArg "${home}/${settingsFile}"}
                    mkdir -p "$(dirname "$target")"
                    if [ -e "$target" ]; then
                        existing="$target"
                    else
                        existing="${pkgs.writeText "empty-pi-settings.json" "{}"}"
                    fi
                    tmp="$(mktemp "$target.tmp.XXXXXXXX")"
                    if ! ${pkgs.jq}/bin/jq -s '.[0] * .[1]' \
                        "$existing" "${self}/${settingsFile}" > "$tmp"; then
                        rm -f "$tmp"
                        exit 1
                    fi
                    if cmp -s "$tmp" "$target" && [ ! -L "$target" ]; then
                        rm -f "$tmp"
                    else
                        mv -f "$tmp" "$target"
                    fi
                )
            '';

        wrappedPi = { lib, pkgs }:
            let
                package = pkgs.pi-coding-agent;
            in pkgs.symlinkJoin {
                inherit (package) meta;
                name = "${lib.getName package}-wrapped-${lib.getVersion package}";
                paths = [ package ];
                preferLocalBuild = true;
                nativeBuildInputs = [ pkgs.makeWrapper ];
                postBuild = ''
                    wrapProgram $out/bin/pi \
                        --set-default GIT_OPTIONAL_LOCKS 0 \
                        --suffix PATH : ${lib.makeBinPath (extraPackages pkgs)}
                '';
            };
    in {
        homeManagerModules.default = { config, lib, pkgs, ... }: {
            home.packages = [ (wrappedPi { inherit lib pkgs; }) ];

            home.file = lib.genAttrs configFiles (file: {
                source = "${self}/${file}";
            });

            home.activation.mergePiSettings = lib.hm.dag.entryAfter [ "linkGeneration" ]
                (mergeSettingsScript {
                    inherit lib pkgs;
                    home = config.home.homeDirectory;
                });
        };

        nixosModules.default = { config, lib, pkgs, ... }:
        let
            home = config.users.users.root.home;
        in {
            environment.systemPackages = [ (wrappedPi { inherit lib pkgs; }) ];

            systemd.tmpfiles.rules = map
                (file: "L+ ${home}/${file} - - - - ${self}/${file}")
                configFiles;

            system.activationScripts.pi-settings = {
                deps = [ "users" ];
                text = mergeSettingsScript { inherit lib pkgs home; };
            };
        };
    };
}
