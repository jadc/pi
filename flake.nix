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
                    existing="$target"
                    [ -e "$target" ] || existing="${pkgs.writeText "empty-pi-settings.json" "{}"}"
                    tmp="$(mktemp "$target.tmp.XXXXXXXX")"
                    trap 'rm -f "$tmp"' EXIT
                    ${pkgs.jq}/bin/jq -s '.[0] * .[1]' "$existing" "${self}/${settingsFile}" > "$tmp"
                    if [ -L "$target" ] || ! cmp -s "$tmp" "$target"; then
                        mv -f "$tmp" "$target"
                    fi
                )
            '';

        wrappedPi = { lib, pkgs }: pkgs.symlinkJoin {
            inherit (pkgs.pi-coding-agent) meta;
            name = "${lib.getName pkgs.pi-coding-agent}-wrapped-${lib.getVersion pkgs.pi-coding-agent}";
            paths = [ pkgs.pi-coding-agent ];
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
