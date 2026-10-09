# "Open folder" helper for the Twenty folder-path field

The Text field option **Folder path** shows an **Open** button. Browsers cannot
open a local folder from an `https` page via `file://` (security sandbox), so
the button triggers a custom protocol, **`openfoldercrm://`**, that a small
Windows registry handler maps to Windows Explorer.

- **Where the handler is installed:** on each **Windows client** that needs the
  Open button to work (not on the server).
- **Without the handler:** the Open button does nothing; users can still use the
  **Copy** button and paste the path into Explorer.

## How it works

1. In the browser, the Open button navigates a hidden iframe to
   `openfoldercrm://<url-encoded-absolute-path>`.
2. Windows looks up the `openfoldercrm` protocol in the registry and runs the
   handler with the full URL as `%1`.
3. The handler (an inline PowerShell one-liner) strips the `openfoldercrm://`
   prefix, URL-decodes the path, checks it exists, and opens it with
   `Invoke-Item` (i.e. Windows Explorer).

The path is only ever passed to `Invoke-Item -LiteralPath` as data (never to a
shell), and the handler refuses paths that do not exist, which limits abuse.

## Quick manual test (single machine)

1. Copy `openfoldercrm.reg` to the Windows machine.
2. For a no-admin per-user test, edit it and replace every
   `HKEY_LOCAL_MACHINE\SOFTWARE\Classes` with
   `HKEY_CURRENT_USER\SOFTWARE\Classes`.
3. Double-click the `.reg` (or `reg import openfoldercrm.reg`) and accept.
4. In Twenty, click **Open** on a folder-path field. Explorer should open at the
   path. You can also test the scheme directly from the Run dialog (Win+R):
   `openfoldercrm://C%3A%5CWindows`.

## Fleet deployment via GPO (recommended)

`openfoldercrm.reg` writes to `HKLM`, so it applies to every user on the
machine. Two common options:

### Option 1 — Group Policy Preferences (no scripts)

1. Put `openfoldercrm.reg` on a share readable by the target computers
   (e.g. `\\server\netlogon\openfoldercrm.reg`).
2. Open **Group Policy Management**, edit a GPO linked to the OU that contains
   the target **computers**.
3. Go to **Computer Configuration → Preferences → Windows Settings → Registry**.
4. Right-click → **New → Registry Wizard**, browse a reference machine where the
   `.reg` was already imported, and select the `openfoldercrm` keys — or add the
   keys/values manually to mirror the `.reg`. Set the action to **Update**.
5. Apply the GPO; clients pick it up on the next Group Policy refresh
   (`gpupdate /force` to test immediately).

### Option 2 — Startup script that imports the .reg

1. Place `openfoldercrm.reg` on a share readable by the computer accounts.
2. In the GPO: **Computer Configuration → Policies → Windows Settings →
   Scripts (Startup/Shutdown) → Startup → Add**.
3. Use `reg.exe` with:
   - Script name: `reg.exe`
   - Parameters: `import \\server\netlogon\openfoldercrm.reg`

   (Startup scripts run as SYSTEM, which can write `HKLM`.)
4. Reboot a test machine (or `gpupdate /force` then re-run the script) to apply.

## Changing the protocol name

If you rename the scheme, keep three places in sync:
- `OPEN_FOLDER_PROTOCOL` in
  `packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/utils/buildOpenFolderProtocolUrl.ts`,
- the registry key name, and
- the `-replace '^<scheme>://',''` prefix in the handler command.
