# "Open folder" helper for the Twenty folder-path field

The Text field option **Folder path** shows an **Open** button. Browsers cannot
open a local folder from an `https` page via `file://` (security sandbox), so
the button triggers a custom protocol, **`openfoldercrm://`**, that a small
Windows handler maps to Windows Explorer.

- **Where the handler is installed:** on each **Windows client** that needs the
  Open button to work (not on the server).
- **Without the handler:** the Open button does nothing; users can still use the
  **Copy** button and paste the path into Explorer.

## Files

Two files, deployed **together** on the client:

- `open-folder.vbs` → deployed to `C:\ProgramData\TwentyCRM\open-folder.vbs`
- `openfoldercrm.reg` → registers the protocol to call that script

The registry runs the script via `wscript.exe`, which **shows no window**. The
script then launches PowerShell hidden to decode the path (UTF-8 aware, so
accented folder names work) and open it with `Invoke-Item` (Windows Explorer).

> Note: an earlier version pointed the registry directly at `powershell.exe`,
> which briefly flashed a PowerShell console window. The `.vbs` wrapper removes
> that window entirely.

## How it works

1. In the browser, the Open button navigates a hidden iframe to
   `openfoldercrm://<url-encoded-absolute-path>`.
2. Windows looks up the `openfoldercrm` protocol and runs
   `wscript.exe "C:\ProgramData\TwentyCRM\open-folder.vbs" "<url>"`.
3. The script strips the `openfoldercrm://` prefix, URL-decodes the path, checks
   it exists, and opens it in Explorer — no visible window at any step.

The path is only ever passed to `Invoke-Item -LiteralPath` as data (never to a
shell), and the handler refuses paths that do not exist, which limits abuse.

## Quick manual test (single machine)

1. Create `C:\ProgramData\TwentyCRM\` and copy `open-folder.vbs` into it.
2. For a no-admin per-user test, edit `openfoldercrm.reg` and replace every
   `HKEY_LOCAL_MACHINE\SOFTWARE\Classes` with
   `HKEY_CURRENT_USER\SOFTWARE\Classes`.
3. Double-click the `.reg` (or `reg import openfoldercrm.reg`) and accept.
4. In Twenty, click **Open** on a folder-path field. Explorer should open at the
   path, with no PowerShell window. You can also test from the Run dialog
   (Win+R): `openfoldercrm://C%3A%5CWindows`.

## Fleet deployment via GPO (recommended)

Deploy **both** the file and the registry keys to the target **computers**.

### 1. Deploy `open-folder.vbs`

**Computer Configuration → Preferences → Windows Settings → Files**
- Source: `\\server\netlogon\open-folder.vbs`
- Destination: `C:\ProgramData\TwentyCRM\open-folder.vbs`
- Action: Update (creates the folder if missing)

### 2. Register the protocol (`HKLM`)

Option A — **Group Policy Preferences (no scripts)**
- **Computer Configuration → Preferences → Windows Settings → Registry**
- Add the `openfoldercrm` keys/values to mirror `openfoldercrm.reg` (Registry
  Wizard can import them from a reference machine). Action: Update.

Option B — **Startup script that imports the .reg**
- **Computer Configuration → Policies → Windows Settings → Scripts
  (Startup/Shutdown) → Startup → Add**
- Script: `reg.exe`  Parameters: `import \\server\netlogon\openfoldercrm.reg`
- (Startup scripts run as SYSTEM, which can write `HKLM`.)

Apply with `gpupdate /force` on a test machine, then reboot / re-log to be sure
the Files preference has run. Both files must be present for the button to work.

## Changing the protocol name

If you rename the scheme, keep these in sync:
- `OPEN_FOLDER_PROTOCOL` in
  `packages/twenty-front/src/modules/object-record/record-field/ui/meta-types/display/utils/buildOpenFolderProtocolUrl.ts`,
- the registry key name,
- the `-replace '^<scheme>://',''` prefix in `open-folder.vbs`.
