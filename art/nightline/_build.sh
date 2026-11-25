#!/bin/bash
# scratch: assemble tools/blender/make_nl_quay.py from the parts
cd "$(dirname "$0")/_parts" && cat p1.py p2.py p2b.py p3.py p4.py > ../../../tools/blender/make_nl_quay.py
