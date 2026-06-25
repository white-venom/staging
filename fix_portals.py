import os

directory = r'c:\Users\DELL\Desktop\work\crediiflow\do-it-services\frontend\src\app\admin\components'

target_string = 'label: isBankNameRedundant ? displayName : `${displayName}${p.bank_name ? ` (${p.bank_name})` : ""}`'
replacement_string = 'label: displayName'

count = 0
for root, _, files in os.walk(directory):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if target_string in content:
                new_content = content.replace(target_string, replacement_string)
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {path}')
                count += 1

print(f'Total files updated: {count}')
