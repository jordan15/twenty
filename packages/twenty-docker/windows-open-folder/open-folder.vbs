' Twenty CRM - "openfoldercrm://" protocol handler.
'
' Receives the full URL as its first argument, decodes the absolute path
' (UTF-8 aware, done by PowerShell) and opens it in Windows Explorer.
'
' It is launched through wscript.exe, which never shows a console window, and it
' starts PowerShell with a hidden window (Run "...", 0, False). This avoids the
' PowerShell window that appears when the registry command runs powershell.exe
' directly.
'
' The URL is embedded directly in the PowerShell script (not passed as $args),
' because $args is not reliably populated when PowerShell is started through
' WScript.Shell.Run.
Option Explicit

If WScript.Arguments.Count = 0 Then WScript.Quit

Dim url
url = WScript.Arguments(0)

' encodeURIComponent leaves single quotes unescaped, so double them to keep the
' PowerShell single-quoted string safe.
url = Replace(url, "'", "''")

Dim psScript
psScript = "$u='" & url & "'; " & _
  "$p=[uri]::UnescapeDataString(($u -replace '^openfoldercrm:(//)?','' -replace '/$','')); " & _
  "if (Test-Path -LiteralPath $p) { Invoke-Item -LiteralPath $p }"

Dim cmd
cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command " & Chr(34) & psScript & Chr(34)

' 0 = hidden window, False = do not wait for PowerShell to exit.
CreateObject("WScript.Shell").Run cmd, 0, False
