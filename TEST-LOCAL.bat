@echo off
setlocal
node --test tests\*.test.mjs
if errorlevel 1 exit /b 1
python tools\generate-looprd.py --check
if errorlevel 1 exit /b 1
python -m unittest discover -s tests -p test_*.py -v
exit /b %errorlevel%
