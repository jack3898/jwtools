{
  description = "Node.js dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          # Add packages here that are useful for a development environment!
          # Please go to: https://search.nixos.org/packages to find packages.
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.corepack
              pkgs.nixfmt
            ];

            shellHook = ''
              INSTALL_DIR=./.nix/bin

              mkdir -p "$INSTALL_DIR"
              export PATH="$INSTALL_DIR:$PATH"
              corepack enable --install-directory="$INSTALL_DIR"
              corepack prepare --activate


              echo "Running dev shell! Binaries have been placed in $INSTALL_DIR

              Node.js: $(node -v)
              Corepack: $(corepack --version)
              pnpm: $(pnpm -v)

              Type 'exit' to leave the dev shell."
            '';
          };
        }
      );
    };
}
