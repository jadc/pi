{
    outputs = { self, ... }: {
        homeManagerModules.default = { pkgs, ... }: {
            programs.pi-coding-agent = {
                enable = true;
                extraPackages = [ pkgs.nodejs_latest ];
            };

            # Explicitly symlink each modified file, such that pi is able to write in others.
            home.file = {
                ".pi-lens/config.json".source = "${self}/.pi-lens/config.json";
                ".pi/agent/extensions/header.ts".source = "${self}/.pi/agent/extensions/header.ts";
                ".pi/agent/extensions/last-model.ts".source = "${self}/.pi/agent/extensions/last-model.ts";
                ".pi/agent/extensions/pi-footer.json".source = "${self}/.pi/agent/extensions/pi-footer.json";
                ".pi/agent/settings.json".source = "${self}/.pi/agent/settings.json";
                ".pi/agent/themes/custom.json".source = "${self}/.pi/agent/themes/custom.json";
                ".pi/web-search.json".source = "${self}/.pi/web-search.json";
            };
        };
    };
}
