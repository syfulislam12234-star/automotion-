import re
lines = open(r'c:\Users\Enter_Computers\Documents\automotion\automotion-\src\components\SupportTickets.tsx', encoding='utf-8').read().splitlines()
depth = 0
in_string = False
string_char = ''
for i, line in enumerate(lines):
    j = 0
    while j < len(line):
        ch = line[j]
        if in_string:
            if ch == '\\' and j + 1 < len(line):
                j += 2
                continue
            if ch == string_char:
                in_string = False
            j += 1
            continue
        if ch in ('`', '"', "'"):
            in_string = True
            string_char = ch
            j += 1
            continue
        if ch == '/' and j + 1 < len(line) and line[j+1] == '/':
            break  # skip rest (comment)
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
        if depth < 0:
            print(f'NEG at line {i+1} depth={depth}: {line[:70]}')
        j += 1
    if i >= 155 and i <= 165:
        print(f'line {i+1:3d} depth={depth:2d}: {line.rstrip()[:70]}')
print('FINAL depth:', depth)
