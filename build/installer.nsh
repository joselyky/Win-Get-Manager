!include MUI2.nsh
!include nsDialogs.nsh
!include LogicLib.nsh

Var WingetDialog
Var CheckboxWinget
Var CheckboxWinget_State

; ─── Pagina personalizada en el instalador NSIS ─────────────────────────────
Page custom WingetPageCreate WingetPageLeave

Function WingetPageCreate
  !insertmacro MUI_HEADER_TEXT "Activacion de WinGet" "Habilitar la herramienta winget en la terminal de Windows"

  nsDialogs::Create 1018
  Pop $WingetDialog
  ${If} $WingetDialog == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 26u "WinGet Manager requiere el Administrador de paquetes de Windows (winget) para detectar y actualizar tus aplicaciones."
  Pop $0

  ${NSD_CreateLabel} 0 28u 100% 22u "En la mayoria de instalaciones de Windows, winget esta desactivado en la terminal por falta de alias o configuracion de PATH."
  Pop $0

  ${NSD_CreateCheckbox} 0 54u 100% 15u "Activar y registrar WinGet en la terminal de Windows (Recomendado)"
  Pop $CheckboxWinget
  ${NSD_SetState} $CheckboxWinget ${BST_CHECKED}

  ${NSD_CreateLabel} 12u 72u 90% 40u "Esta opcion registrara el paquete oficial 'Microsoft.DesktopAppInstaller', reparara el alias de ejecucion y anadira WindowsApps a tu variable PATH de forma completamente automatica."
  Pop $0

  nsDialogs::Show
FunctionEnd

Function WingetPageLeave
  ${NSD_GetState} $CheckboxWinget $CheckboxWinget_State
FunctionEnd

!macro customInit
  ; Por defecto activado (1)
  StrCpy $CheckboxWinget_State "1"
!macroend

!macro customInstall
  ${If} $CheckboxWinget_State == "1"
    DetailPrint "Activando y registrando WinGet en la terminal de Windows..."
    ; Ejecutar el script PowerShell de activacion
    nsExec::ExecToLog 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\scripts\enable-winget.ps1"'
    DetailPrint "Configuracion de WinGet finalizada."
  ${EndIf}
!macroend
