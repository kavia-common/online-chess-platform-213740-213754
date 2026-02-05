#!/bin/bash
cd /home/kavia/workspace/code-generation/online-chess-platform-213740-213754/frontend_chess_app
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

