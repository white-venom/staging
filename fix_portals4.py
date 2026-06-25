import os

directory = r'c:\Users\DELL\Desktop\work\crediiflow\do-it-services\frontend\src\app\admin\components'

# There are basically 4 indentation levels: 26 spaces, 28 spaces, 30 spaces, 32 spaces.
# Also group.name vs p.groupName depending on the file.

variations = []

for indent in [26, 28, 30, 32]:
    ind = " " * indent
    for gname in ["group.name", "p.groupName"]:
        # some files have p.portal_name.toLowerCase(); others have (p.portal_name || "").toLowerCase();
        for pname_expr in ["p.portal_name.toLowerCase()", '(p.portal_name || "").toLowerCase()']:
            
            old_str = f'''{ind}const pNameLower = {pname_expr};
{ind}const bNameLower = (p.bank_name || "").toLowerCase();
{ind}const isBankNameRedundant = bNameLower && (pNameLower.includes(bNameLower) || bNameLower.includes(pNameLower));
{ind}const displayName = {gname} && {gname}.toLowerCase() !== pNameLower
{ind}  ? `${{{gname}}} - ${{p.portal_name}}`
{ind}  : p.portal_name;
{ind}return {{ value: String(p.id), label: displayName }};'''

            old_str2 = f'''{ind}const bNameLower = (p.bank_name || "").toLowerCase();
{ind}const pNameLower = {pname_expr};
{ind}const isBankNameRedundant = bNameLower && (pNameLower.includes(bNameLower) || bNameLower.includes(pNameLower));
{ind}const displayName = {gname} && {gname}.toLowerCase() !== pNameLower
{ind}  ? `${{{gname}}} - ${{p.portal_name}}`
{ind}  : p.portal_name;
{ind}return {{ value: String(p.id), label: displayName }};'''

            new_str = f'''{ind}return {{ value: String(p.id), label: {gname} || p.portal_name }};'''

            variations.append((old_str, new_str))
            variations.append((old_str2, new_str))


count = 0
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for old, new in variations:
                new_content = new_content.replace(old, new)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {path}')
                count += 1

print(f'Total files updated: {count}')
