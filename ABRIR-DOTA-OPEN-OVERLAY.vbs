Option Explicit

Dim files, shell, projectPath, electronPath, environment
Set files = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

projectPath = files.GetParentFolderName(WScript.ScriptFullName)
electronPath = projectPath & "\node_modules\electron\dist\electron.exe"

If Not files.FileExists(electronPath) Then
  MsgBox "O aplicativo ainda não foi preparado. Execute npm install uma vez.", 16, "Dota Open Overlay"
  WScript.Quit 1
End If

shell.CurrentDirectory = projectPath
Set environment = shell.Environment("PROCESS")
On Error Resume Next
environment.Remove "ELECTRON_RUN_AS_NODE"
On Error GoTo 0
shell.Run Chr(34) & electronPath & Chr(34) & " .", 1, False
