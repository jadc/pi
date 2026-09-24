{
    outputs = { self, ... }: {
        homeManagerModules.default = { config, lib, pkgs, ... }: {
            programs.pi-coding-agent = {
                enable = true;
                extraPackages = [ pkgs.nodejs ];
            };

            # Explicitly symlink each modified file, such that pi is able to write in others.
            home.file = {
                ".pi-lens/config.json".source = "${self}/.pi-lens/config.json";
                ".pi/agent/extensions/header.ts".source = "${self}/.pi/agent/extensions/header.ts";
                ".pi/agent/extensions/pi-footer.json".source = "${self}/.pi/agent/extensions/pi-footer.json";
                ".pi/agent/themes/custom.json".source = "${self}/.pi/agent/themes/custom.json";
                ".pi/web-search.json".source = "${self}/.pi/web-search.json";
            };

            # Pi writes settings itself, so keep the merged file writable rather than
            # linking it into the read-only Nix store.
            home.activation.mergePiSettings = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
                (
                    set -e
                    umask 077
                    target="${config.home.homeDirectory}/.pi/agent/settings.json"
                    mkdir -p "$(dirname "$target")"
                    if [ -e "$target" ]; then
                        existing="$target"
                    else
                        existing="${pkgs.writeText "empty-pi-settings.json" "{}"}"
                    fi
                    tmp="$(mktemp "$target.tmp.XXXXXXXX")"
                    if ! ${pkgs.jq}/bin/jq -s '.[0] * .[1]' \
                        "$existing" "${self}/.pi/agent/settings.json" > "$tmp"; then
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
        };
    };
}
