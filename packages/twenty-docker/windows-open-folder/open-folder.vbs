' Twenty CRM - "openfoldercrm://" protocol handler.
'
' Receives the full URL as its first argument, decodes the absolute path
' (UTF-8 aware, done by PowerShell) and opens it in Windows Explorer.
'
' It is launched through wscript.exe, which never shows a console window, and it
' starts PowerShell with a hidden window (Run "...", 0, False). This avoids the
' PowerShell window that appears when the registry command runs powershell.exe
' directly.
Option Explicit

If WScript.Arguments.Count = 0 Then WScript.Quit

Dim url
url = WScript.Arguments(0)

' The URL is produced with encodeURIComponent on the front-end, so it only
' contains unreserved characters and %XX escapes: no quotes or spaces, which
' makes it safe to embed between double quotes below.
Dim psScript
psScript = "$u=$args[0]; " & _
  "$p=[uri]::UnescapeDataString(($u -replace '^openfoldercrm://','' -replace '/$','')); " & _
  "if (Test-Path -LiteralPath $p) { Invoke-Item -LiteralPath $p }"

Dim cmd
cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command " & _
  Chr(34) & psScript & Chr(34) & " " & Chr(34) & url & Chr(34)

' 0 = hidden window, False = do not wait for PowerShell to exit.
CreateObject("WScript.Shell").Run cmd, 0, False
