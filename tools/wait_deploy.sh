#!/bin/sh
# Ждёт, пока GitHub соберёт последний коммит, и печатает, какая сборка лежит по ссылке.
sha=$(git rev-parse --short HEAD)
for i in $(seq 1 45); do
  r=$(curl -s -x http://127.0.0.1:2080 "https://api.github.com/repos/LexxKomr/greywick-mysteries/actions/runs?per_page=1" | python -c "import sys,json; d=json.load(sys.stdin)['workflow_runs'][0]; print(d['head_sha'][:7], d['status'], d['conclusion'])")
  case "$r" in "$sha completed"*) break;; esac
  sleep 10
done
echo "GitHub: $r"
sleep 15
echo "по ссылке: $(curl -s -x http://127.0.0.1:2080 https://lexxkomr.github.io/greywick-mysteries/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js')"
echo "локально:  $(ls dist/assets | grep 'index-.*js')"
