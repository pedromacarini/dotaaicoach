!include nsDialogs.nsh
!include LogicLib.nsh

Var ActivationDialog
Var ActivationInput

Page custom DotaActivationPageCreate DotaActivationPageLeave

Function DotaActivationPageCreate
  nsDialogs::Create 1018
  Pop $ActivationDialog
  ${If} $ActivationDialog == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 28u "Código de ativação do DotaIACoach"
  Pop $0
  ${NSD_CreateLabel} 0 30u 100% 34u "Cole o código de 20 caracteres recebido para ativar este computador."
  Pop $0
  ${NSD_CreateText} 0 68u 100% 14u ""
  Pop $ActivationInput
  nsDialogs::Show
FunctionEnd

Function DotaActivationPageLeave
  ${NSD_GetText} $ActivationInput $0
  StrLen $1 $0
  ${If} $1 != 20
    MessageBox MB_ICONEXCLAMATION|MB_OK "O código precisa ter exatamente 20 caracteres."
    Abort
  ${EndIf}
  CreateDirectory "$APPDATA\dota-iacoach"
  FileOpen $2 "$APPDATA\dota-iacoach\pending-activation.txt" w
  FileWrite $2 $0
  FileClose $2
FunctionEnd
