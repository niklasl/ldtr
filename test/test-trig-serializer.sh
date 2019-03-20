#!/bin/bash
cd $(dirname $0)/data

for doc in $(ls); do
    echo "# $doc"
    ldtr $doc -o trig | ldtr -ttrig -otrig
done
