{
    outputs = { self, ... }: {
        homeManagerModules.default = { pkgs, ... }: {
            programs.pi-coding-agent = {
                enable = true;
                extraPackages = [ pkgs.nodejs_latest ];
            };

            # Explicitly symlink each modified file, such that pi is able to write in others.
            home.file = {
                ".pi/agent/settings.json".source = "${self}/.pi/agent/settings.json";
                ".pi/agent/extensions/pi-footer.json".source = "${self}/.pi/agent/extensions/pi-footer.json";
                ".pi-lens/config.json".source = "${self}/.pi-lens/config.json";
            };
        };
    };
}
