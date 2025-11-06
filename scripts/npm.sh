#!/bin/sh
set -ex
rm -rf dist
./rolldown.config.js
scripts/emit-dts.sh
cp package.json dist
