; SmartShule NSIS Installer Script
; Generates a portable Windows installer for SmartShule
; Output: /home/z/my-project/dist/SmartShule-Setup.exe

!define APP_NAME "SmartShule"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "SmartShule"
!define APP_URL "https://smartshule.app"
!define APP_EXE "SmartShule.exe"
!define APP_ID "com.smartshule.app"

; Include modern UI
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; General
Name "${APP_NAME}"
OutFile "/home/z/my-project/download/SmartShule-Setup.exe"
Unicode True
ShowInstDetails show
ShowUnInstDetails show
SetCompressor lzma
SetCompressorDictSize 32
BrandingText "SmartShule ${APP_VERSION} Installer"

; Request application privileges (per-user, no admin required)
RequestExecutionLevel user

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "/home/z/my-project/public/icon.ico"
!define MUI_UNICON "/home/z/my-project/public/icon.ico"

; Installer pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "/home/z/my-project/LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "French"

; Default install directory (per-user)
InstallDir "$LOCALAPPDATA\Programs\SmartShule"

; Registry key for install info
!define REG_UNINSTALL "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

; -----------------------------
; Installer sections
; -----------------------------
Section "SmartShule Application" SecApp
  SectionIn RO

  ; Set output path
  SetOutPath "$INSTDIR"

  ; Copy all files from win-unpacked
  File /r "/home/z/my-project/dist/win-unpacked/*.*"

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry entries
  WriteRegStr SHCTX "${REG_UNINSTALL}" "DisplayName" "${APP_NAME}"
  WriteRegStr SHCTX "${REG_UNINSTALL}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr SHCTX "${REG_UNINSTALL}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr SHCTX "${REG_UNINSTALL}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr SHCTX "${REG_UNINSTALL}" "URLInfoAbout" "${APP_URL}"
  WriteRegStr SHCTX "${REG_UNINSTALL}" "InstallLocation" "$INSTDIR"
  WriteRegStr SHCTX "${REG_UNINSTALL}" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
  WriteRegDWORD SHCTX "${REG_UNINSTALL}" "NoModify" 1
  WriteRegDWORD SHCTX "${REG_UNINSTALL}" "NoRepair" 1

  ; Compute installed size for Add/Remove Programs
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD SHCTX "${REG_UNINSTALL}" "EstimatedSize" "$0"
SectionEnd

; -----------------------------
; Shortcuts section
; -----------------------------
Section "Create Shortcuts" SecShortcuts
  ; Desktop shortcut
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Start Menu shortcuts
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
SectionEnd

; -----------------------------
; Uninstaller section
; -----------------------------
Section "Uninstall"
  ; Remove files (everything in install dir)
  RMDir /r "$INSTDIR"

  ; Remove desktop shortcut
  Delete "$DESKTOP\${APP_NAME}.lnk"

  ; Remove Start Menu folder
  RMDir /r "$SMPROGRAMS\${APP_NAME}"

  ; Remove registry entries
  DeleteRegKey SHCTX "${REG_UNINSTALL}"
SectionEnd

; -----------------------------
; Functions
; -----------------------------
Function .onInit
  ; Per-user install - no admin required
  SetShellVarContext current
FunctionEnd

Function un.onInit
  SetShellVarContext current
FunctionEnd

; -----------------------------
; Descriptions
; -----------------------------
LangString DESC_SecApp ${LANG_ENGLISH} "SmartShule application files (required)."
LangString DESC_SecApp ${LANG_FRENCH} "Fichiers de l'application SmartShule (requis)."
LangString DESC_SecShortcuts ${LANG_ENGLISH} "Create desktop and Start Menu shortcuts."
LangString DESC_SecShortcuts ${LANG_FRENCH} "Creer les raccourcis Bureau et Menu Demarrer."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${SecApp} $(DESC_SecApp)
!insertmacro MUI_DESCRIPTION_TEXT ${SecShortcuts} $(DESC_SecShortcuts)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
