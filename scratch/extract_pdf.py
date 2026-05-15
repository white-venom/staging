import fitz  # PyMuPDF
import os

pdf_path = r"D:\work\doit servcie\doitservices_quotation.pdf"

if not os.path.exists(pdf_path):
    print(f"File not found: {pdf_path}")
else:
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    
    print("--- QUOTATION CONTENT ---")
    print(text)
    print("--- END OF CONTENT ---")
