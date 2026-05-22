# Publishing the Fork

These steps publish this fork to `Tanghui-Li/cisco-pt-mcp` on GitHub.

## 1. Rebuild the Packet Tracer Extension

Before committing a release, rebuild `extension/cisco-pt-mcp.pts` from the
current `extension/source/` files in Packet Tracer:

1. Open Packet Tracer.
2. Open **Extensions -> Scripting -> Configure PT Script Modules...**.
3. Import or update the script module source.
4. Export/package the module as `extension/cisco-pt-mcp.pts`.
5. Restart Packet Tracer and call `getBridgeInfo`.

Expected `getBridgeInfo.extensionVersion` for this release: `0.1.13`.

## 2. Create the GitHub Repository

Create an empty public repository named `cisco-pt-mcp` under the `Tanghui-Li`
account. Do not initialize it with README, license, or `.gitignore`; this
repository already contains those files.

## 3. Configure Remotes

```sh
cd "MCP Servers for PT/cisco-pt-mcp"
git remote rename origin upstream
git remote add origin git@github.com:Tanghui-Li/cisco-pt-mcp.git
git remote -v
```

Use HTTPS instead of SSH if preferred:

```sh
git remote add origin https://github.com/Tanghui-Li/cisco-pt-mcp.git
```

## 4. Commit and Push

```sh
git checkout -B main
git add .
git commit -m "feat: expand Packet Tracer MCP bridge coverage"
git tag v0.1.13
git push -u origin main
git push origin v0.1.13
```

## 5. Verify GitHub Actions

After pushing, open the repository's **Actions** tab. The `Build and Test`
workflow should run `pytest`, build distributions, and upload `dist/`
artifacts.

## 6. Optional PyPI Publishing

The package name `cisco-pt-mcp` may already be owned by the upstream project on
PyPI. If you want to publish this fork to PyPI, choose a distinct package name
or coordinate with the upstream maintainer. GitHub-only publishing does not
require PyPI.
