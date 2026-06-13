import os

def fix_syntax_error():
    filepath = "frontend/src/app/staff/page.tsx"
    if not os.path.exists(filepath):
        print(f"Error: {filepath} not found")
        return
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Find position of "function WalletCard"
    idx = content.find("function WalletCard")
    if idx == -1:
        print("Could not find WalletCard")
        return

    # Find the next occurrence of "function NavigationGrid"
    grid_idx = content.find("function NavigationGrid", idx)
    if grid_idx == -1:
        print("Could not find NavigationGrid")
        return

    wallet_section = content[idx:grid_idx]
    print("Found WalletCard section. Length:", len(wallet_section))

    # We want to replace the end of the WalletCard section.
    # Let's look at the last few lines of wallet_section.
    # In LF normalized form, it should end with:
    #       </div>
    #     </div>
    #   );
    # }
    
    # We want to change it to:
    #         </div>
    #       </div>
    #     </div>
    #   );
    # }

    # Let's normalize wallet_section newlines to LF for replacing
    wallet_section_lf = wallet_section.replace("\r\n", "\n")
    
    old_end = "      </div>\n    </div>\n  );\n}\n\n"
    new_end = "        </div>\n      </div>\n    </div>\n  );\n}\n\n"
    
    if wallet_section_lf.endswith(old_end):
        new_wallet_section_lf = wallet_section_lf[:-len(old_end)] + new_end
        # Convert back to original newlines if needed, or just write LF
        # (Next.js/Git handles LF files perfectly, but let's preserve CRLF if original had it)
        if "\r\n" in wallet_section:
            new_wallet_section = new_wallet_section_lf.replace("\n", "\r\n")
        else:
            new_wallet_section = new_wallet_section_lf
            
        content = content[:idx] + new_wallet_section + content[grid_idx:]
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print("Successfully fixed WalletCard closing tags!")
    else:
        print("WalletCard section does not end with expected tags. End is:")
        print(repr(wallet_section_lf[-100:]))

if __name__ == "__main__":
    fix_syntax_error()
