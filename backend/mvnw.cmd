@ECHO OFF
SETLOCAL
SET MAVEN_CMD=mvn
WHERE %MAVEN_CMD% >NUL 2>NUL
IF %ERRORLEVEL% NEQ 0 (
  ECHO Apache Maven was not found in PATH.
  ECHO Install Maven or generate the official Maven Wrapper once JDK 21 is available.
  EXIT /B 1
)
%MAVEN_CMD% %*

