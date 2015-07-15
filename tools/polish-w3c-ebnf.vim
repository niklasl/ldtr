" Vim Script for Polishing W3C EBNF Grammar into EBNF parsable by PEG.js
" Usage:
" 1. Copy & Paste from a W3C Spec
" 2. Source this file on the text
" 3. Feed this text to PEG.js

g/^[^=]\+$/d
%s/\[[^]]\+\]\t//

%s/::=/=/
%s# | # / #g
%s/\\/\\\\/g
%s/#x\?\(\w\w\w\w\)/\\u\1/eg
%s/#x\(\w\w\w\)/\\u0\1/eg
%s/#x\(\w\w\)/\\u00\1/g
%s/#x\(\w\)/\\u000\1/g
%s/#x/\\u00/eg
%s/\(\s\+\)\(\\u[0-9A-Z]\+\)/\1'\2'/g
