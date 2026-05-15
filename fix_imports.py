import os
import glob

# Path to the components
base_path = "frontend/src/app/admin/components"
desktop_files = glob.glob(os.path.join(base_path, "desktop/*.tsx"))
mobile_files = glob.glob(os.path.join(base_path, "mobile/*.tsx"))

files = desktop_files + mobile_files

for f in files:
    try:
        with open(f, 'r', encoding='utf-8') as file:
            content = file.read()
            
        new_content = content
        
        # Update API imports
        new_content = new_content.replace('from "../../utils/api"', 'from "../../../utils/api"')
        new_content = new_content.replace("from '../../utils/api'", "from '../../../utils/api'")
        
        # Update AdminContext imports
        new_content = new_content.replace('from "../context/AdminContext"', 'from "../../context/AdminContext"')
        new_content = new_content.replace("from '../context/AdminContext'", "from '../../context/AdminContext'")
        
        if content != new_content:
            with open(f, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Fixed: {f}")
    except Exception as e:
        print(f"Error fixing {f}: {e}")
