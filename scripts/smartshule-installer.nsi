; SmartShule — Installateur NSIS Professionnel avec Branding Complet
; ============================================================
; Inclut :
;   - Logo sur page d'accueil (welcome bitmap 164x314)
;   - Logo en en-tête (header bitmap 150x57)
;   - Icône SmartShule-Setup.exe (logo officiel)
;   - Icône raccourcis Bureau + Menu Démarrer
;   - Splash screen optionnel
; Output : /home/z/my-project/download/SmartShule-Setup.exe

!define APP_NAME "SmartShule"
!define APP_VERSION "1.2.1"
!define APP_PUBLISHER "SmartShule"
!define APP_URL "https://smartshule.app"
!define APP_EXE "SmartShule.exe"
!define APP_ID "com.smartshule.app"

; Include modern UI 2
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"

; General
Name "${APP_NAME}"
OutFile "/home/z/my-project/download/SmartShule-Setup.exe"
Unicode True
ShowInstDetails show
ShowUnInstDetails show
SetCompressor /SOLID lzma
SetCompressorDictSize 16

; Icône de l'installateur (apparaît sur SmartShule-Setup.exe + taskbar)
Icon "/home/z/my-project/public/icon.ico"

; Branding text (barre de titre en bas)
BrandingText "SmartShule ${APP_VERSION}"

; Request application privileges (per-user, no admin required)
RequestExecutionLevel user

; ============================================================
; Interface settings — BRANDING COMPLET
; ============================================================

!define MUI_ABORTWARNING
!define MUI_ICON "/home/z/my-project/public/icon.ico"
!define MUI_UNICON "/home/z/my-project/public/icon.ico"

; Page d'accueil avec logo (164x314 px)
!define MUI_WELCOMEFINISHPAGE_BITMAP "/home/z/my-project/build/installer-welcome.png"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "/home/z/my-project/build/installer-welcome.png"

; En-tête avec logo (150x57 px) — visible sur toutes les pages internes
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "/home/z/my-project/build/installer-header.png"
!define MUI_HEADERIMAGE_UNBITMAP "/home/z/my-project/build/installer-header.png"

; Texte de la page d'accueil
!define MUI_WELCOMEPAGE_TITLE "Bienvenue dans l'installation de SmartShule"
!define MUI_WELCOMEPAGE_TEXT "L'assistant va installer SmartShule ${APP_VERSION} sur votre ordinateur.\r\n\r\nSmartShule est la plateforme de gestion scolaire qui rapproche l'école et la famille.\r\n\r\nCliquez sur Suivant pour continuer ou Annuler pour quitter."

; Texte page de fin
!define MUI_FINISHPAGE_TITLE "Installation terminée"
!define MUI_FINISHPAGE_TEXT "SmartShule a été installé avec succès sur votre ordinateur.\r\n\r\nCliquez sur Terminer pour fermer cet assistant."
!define MUI_FINISHPAGE_RUN_TEXT "Lancer SmartShule maintenant"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Voir le guide de démarrage rapide"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\QUICKSTART.txt"
!define MUI_FINISHPAGE_LINK "Visiter le site SmartShule"
!define MUI_FINISHPAGE_LINK_LOCATION "${APP_URL}"

; ============================================================
; Installer pages
; ============================================================
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

; ============================================================
; Installer sections
; ============================================================
Section "SmartShule Application" SecApp
  SectionIn RO

  SetOutPath "$INSTDIR"

  ; Copy all files from win-unpacked
  File /r "/home/z/my-project/dist/win-unpacked/*.*"

  ; Créer le guide de démarrage rapide
  FileOpen $0 "$INSTDIR\QUICKSTART.txt" w
  FileWrite $0 "SmartShule - Guide de demarrage rapide$\r$\n"
  FileWrite $0 "====================================$\r$\n$\r$\n"
  FileWrite $0 "1. Lancez SmartShule depuis le raccourci Bureau$\r$\n"
  FileWrite $0 "2. Au premier demarrage, attendez 3-5 secondes (serveur local demarre)$\r$\n"
  FileWrite $0 "3. Connectez-vous avec votre compte administrateur$\r$\n$\r$\n"
  FileWrite $0 "Compte par defaut :$\r$\n"
  FileWrite $0 "  Email : fabricefb@gmail.com$\r$\n"
  FileWrite $0 "  Mot de passe : Wazengafb@007$\r$\n$\r$\n"
  FileWrite $0 "IMPORTANT : Changez le mot de passe apres le premier login !$\r$\n"
  FileClose $0

  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry entries (Add/Remove Programs)
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

; ============================================================
; Shortcuts section
; ============================================================
Section "Create Shortcuts" SecShortcuts
  ; Desktop shortcut (avec icône logo)
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Start Menu shortcuts (dossier SmartShule avec icône)
  CreateDirectory "$SMPROGRAMS\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Guide demarrage.lnk" "$INSTDIR\QUICKSTART.txt" "" "$WINDIR\notepad.exe" 0
  CreateShortcut "$SMPROGRAMS\${APP_NAME}\Desinstaller.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0
SectionEnd

; ============================================================
; Uninstaller section
; ============================================================
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

; ============================================================
; Functions
; ============================================================
Function .onInit
  SetShellVarContext current
FunctionEnd

Function un.onInit
  SetShellVarContext current
FunctionEnd

; ============================================================
; Descriptions
; ============================================================
LangString DESC_SecApp ${LANG_ENGLISH} "SmartShule application files (required)."
LangString DESC_SecApp ${LANG_FRENCH} "Fichiers de l'application SmartShule (requis)."
LangString DESC_SecShortcuts ${LANG_ENGLISH} "Create desktop and Start Menu shortcuts."
LangString DESC_SecShortcuts ${LANG_FRENCH} "Creer les raccourcis Bureau et Menu Demarrer."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
!insertmacro MUI_DESCRIPTION_TEXT ${SecApp} $(DESC_SecApp)
!insertmacro MUI_DESCRIPTION_TEXT ${SecShortcuts} $(DESC_SecShortcuts)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
