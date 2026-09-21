"""
Complete Reset and 21-Sep-2026 Khatabook Sync for CrediiFlow tenants:
1. Deletes ALL transaction entries (collections, bank_deposits, ledgers, portal_adjustments, attendance, denominations, baselines).
2. Updates / creates all 23 Portals and their Primary BankAccounts with 21-Sep opening balances.
3. Removes portal duplicate names from Retailers table to prevent double-counting.
4. Resets user virtual balances to 0 and business opening cash to 0.
5. Syncs all 268 Retailer entries (including CASH PORTAL) into `retailers` with opening_balance_set_on = 2026-09-21.
6. Recreates fresh Opening Balance ledger entries for all retailers using recalculate_balances.
7. Verifies that Dashboard totals match Khatabook 21-Sep-2026 exactly:
   - Total Give: Rs 7,754,555.00 | Total Take: Rs 7,754,555.00 | Net: Rs 0.00
"""
import os
import sys
import uuid
import json
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if '/app' not in sys.path:
    sys.path.insert(0, '/app')

from app.database.db import get_tenant_connection_string, MasterSessionLocal
from app.database.master_models import Tenant
from app.database.models import (
    Retailer, Portal, BankAccount, User,
    Collection, BankDeposit, Ledger, Denomination, DenominationBaseline,
    PortalAdjustment, Attendance, BusinessSettings
)
from app.logic.ledger import recalculate_balances

TARGET_DATE = date(2026, 9, 21)

PORTALS_DATA = [
  {
    "name": "Portal Soul Pay",
    "take": 54616.0,
    "give": 0.0
  },
  {
    "name": "Portal Sekure Pay",
    "take": 10572.0,
    "give": 0.0
  },
  {
    "name": "Portal Reli Pay",
    "take": 185662.0,
    "give": 0.0
  },
  {
    "name": "Portal Rinova Pay",
    "take": 651535.0,
    "give": 0.0
  },
  {
    "name": "PORTAL PAYNEARBY",
    "take": 253968.0,
    "give": 0.0
  },
  {
    "name": "Portal Parvej Telecom Rinova",
    "take": 362360.0,
    "give": 0.0
  },
  {
    "name": "Portal Deal N Pay",
    "take": 400.0,
    "give": 0.0
  },
  {
    "name": "Portal Airtel Payment Bank",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Od Reli pay",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Portal Paygrt",
    "take": 2494.0,
    "give": 0.0
  },
  {
    "name": "Jaharveer Portal",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Portal K1 Pay",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Od PAYNEARBY",
    "take": 0.0,
    "give": 300000.0
  },
  {
    "name": "Portal Imps Guru",
    "take": 50.0,
    "give": 0.0
  },
  {
    "name": "Portal Pay 1",
    "take": 469.0,
    "give": 0.0
  },
  {
    "name": "Super Sekure Pay Portal",
    "take": 1000.0,
    "give": 0.0
  },
  {
    "name": "Portal Appar Service",
    "take": 5500.0,
    "give": 0.0
  },
  {
    "name": "Portal Go Payment",
    "take": 100.0,
    "give": 0.0
  },
  {
    "name": "Od Rinova",
    "take": 0.0,
    "give": 500000.0
  },
  {
    "name": "Portal Vidcom",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "PORTAL SUPER RINOVA PAY",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "PORTAL SUPER PAYNEARBY",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Portal Super Soul Pay",
    "take": 0.0,
    "give": 0.0
  }
]

RETAILERS_DATA = [
  {
    "name": "CASH PORTAL",
    "phone": "9999900001",
    "take": 1092787.0,
    "give": 0.0
  },
  {
    "name": "Dadri Satya Micro",
    "phone": "9999900002",
    "take": 19868.0,
    "give": 0.0
  },
  {
    "name": "Cms Collection",
    "phone": "9999900003",
    "take": 0.0,
    "give": 128227.0
  },
  {
    "name": "Jafer Khan Retailer Soul pay",
    "phone": "9999900004",
    "take": 1859.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Paynearby",
    "phone": "9999900005",
    "take": 123832.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Sekure Pay",
    "phone": "9999900006",
    "take": 5983.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Rinova",
    "phone": "9999900007",
    "take": 38261.0,
    "give": 0.0
  },
  {
    "name": "Aman Money Transfer",
    "phone": "9012319012",
    "take": 248250.0,
    "give": 0.0
  },
  {
    "name": "Mehta Enterprises",
    "phone": "9999900010",
    "take": 72000.0,
    "give": 0.0
  },
  {
    "name": "Karan Wati Digital Photo Studio",
    "phone": "9999900011",
    "take": 0.0,
    "give": 300000.0
  },
  {
    "name": "Azhar Khan 26 Money Transfer",
    "phone": "7088592655",
    "take": 88600.0,
    "give": 0.0
  },
  {
    "name": "Tomar Cyber Cafe Mehtab",
    "phone": "8171361088",
    "take": 165390.0,
    "give": 0.0
  },
  {
    "name": "Indian Cyber Cafe",
    "phone": "8802950371",
    "take": 348400.0,
    "give": 0.0
  },
  {
    "name": "Gagan Cyber Care Rinkesh",
    "phone": "9999900016",
    "take": 34100.0,
    "give": 0.0
  },
  {
    "name": "Dev Enterprises",
    "phone": "9278384111",
    "take": 99500.0,
    "give": 0.0
  },
  {
    "name": "Sharma And Company (Yogi G)",
    "phone": "9999900018",
    "take": 0.0,
    "give": 400000.0
  },
  {
    "name": "Rizwan Retailer Reli Pay",
    "phone": "9999900019",
    "take": 1425.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Reli Pay",
    "phone": "9999900020",
    "take": 0.0,
    "give": 517880.0
  },
  {
    "name": "Khiladi Jan Sewa Kendra Jindal",
    "phone": "9999900022",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Rahul Cyber Cafe Meenakshi",
    "phone": "9999900023",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Anyasha Mohd Akhlaq Ahad Cyber",
    "phone": "9999900024",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Jan Seva Kendra Pushpendra Dasna",
    "phone": "7838927368",
    "take": 32273.0,
    "give": 0.0
  },
  {
    "name": "Rizwan Jan Sewa Sikroda",
    "phone": "9999900026",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Kanha Services",
    "phone": "9999900027",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Choudhary Money Transfer Sachin",
    "phone": "9999900029",
    "take": 53000.0,
    "give": 0.0
  },
  {
    "name": "Ai Technology",
    "phone": "7505178671",
    "take": 45336.0,
    "give": 0.0
  },
  {
    "name": "A K so R gupta g",
    "phone": "9999900031",
    "take": 0.0,
    "give": 539000.0
  },
  {
    "name": "Ankit Communication",
    "phone": "9999900033",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Modinagar Sv Credit Line",
    "phone": "9999900035",
    "take": 33621.0,
    "give": 0.0
  },
  {
    "name": "guru ji garakh sewa Kendra mohit",
    "phone": "9999900036",
    "take": 15100.0,
    "give": 0.0
  },
  {
    "name": "Dhaulana Satya Micro",
    "phone": "9999900037",
    "take": 26998.0,
    "give": 0.0
  },
  {
    "name": "Techno Care",
    "phone": "9999900038",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Lb Cyber Cafe",
    "phone": "9999900039",
    "take": 39600.0,
    "give": 0.0
  },
  {
    "name": "Faizan Fareed Cyber Cafe",
    "phone": "9971540206",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "A S Online Rakib Safi",
    "phone": "9999900041",
    "take": 0.0,
    "give": 12000.0
  },
  {
    "name": "Bhure Telecom",
    "phone": "9999900042",
    "take": 10600.0,
    "give": 0.0
  },
  {
    "name": "Qr Charges Rinova",
    "phone": "9999900043",
    "take": 27537.0,
    "give": 0.0
  },
  {
    "name": "Dilshad G",
    "phone": "9999900044",
    "take": 25636.0,
    "give": 0.0
  },
  {
    "name": "Neetu Pal Rahul Cyber Cafer",
    "phone": "9999900045",
    "take": 24800.0,
    "give": 0.0
  },
  {
    "name": "PNB OFFICE",
    "phone": "8384875457",
    "take": 100209.0,
    "give": 0.0
  },
  {
    "name": "Modinagar Satya Micro",
    "phone": "9999900047",
    "take": 92973.0,
    "give": 0.0
  },
  {
    "name": "Muradnagar Satya Micro",
    "phone": "9999900048",
    "take": 26386.0,
    "give": 0.0
  },
  {
    "name": "Meerut Satya Micro",
    "phone": "9999900049",
    "take": 21250.0,
    "give": 0.0
  },
  {
    "name": "Jahid And Company",
    "phone": "9015493222",
    "take": 0.0,
    "give": 1997.0
  },
  {
    "name": "Aggarwal Communication Chaprula",
    "phone": "9999900051",
    "take": 1.0,
    "give": 0.0
  },
  {
    "name": "Shri Paras Telecom",
    "phone": "9999900052",
    "take": 0.0,
    "give": 594300.0
  },
  {
    "name": "Aarohi Grahak Sewa Kendra",
    "phone": "9999900053",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Jyoti Electronics",
    "phone": "9999900054",
    "take": 10000.0,
    "give": 0.0
  },
  {
    "name": "Aasim Cyber cafe Lb",
    "phone": "9999900055",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Csc Center Sultan Saifi",
    "phone": "9999900056",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Cyber Point",
    "phone": "8077062696",
    "take": 11000.0,
    "give": 0.0
  },
  {
    "name": "SELF",
    "phone": "9999900058",
    "take": 0.0,
    "give": 2124935.0
  },
  {
    "name": "Salman Telecom And Money Transfer",
    "phone": "9999900059",
    "take": 1.0,
    "give": 0.0
  },
  {
    "name": "M A Cyber Cafe mustakeem",
    "phone": "7668373506",
    "take": 2600.0,
    "give": 0.0
  },
  {
    "name": "Grahak Sewa Kendra Rashid Ali kh",
    "phone": "9999900061",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Farhat Cyber Cafe reli pay",
    "phone": "9999900062",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Radhey Krishna Communication",
    "phone": "9999900064",
    "take": 100.0,
    "give": 0.0
  },
  {
    "name": "Parvej Home",
    "phone": "9999900065",
    "take": 40217.0,
    "give": 0.0
  },
  {
    "name": "Choudhary Medical Store Masuri",
    "phone": "9999900066",
    "take": 585.0,
    "give": 0.0
  },
  {
    "name": "Faraz Money Transfer",
    "phone": "9999900067",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shadab Star Communication Dasna",
    "phone": "9999900068",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Raj Bhai",
    "phone": "9999900069",
    "take": 3342.0,
    "give": 0.0
  },
  {
    "name": "Shree Shyam Print And Computer",
    "phone": "9999900070",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Navratan Durga Telecom",
    "phone": "9999900071",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Deal N Pay",
    "phone": "9999900072",
    "take": 2140.0,
    "give": 0.0
  },
  {
    "name": "Cdm Stuck details",
    "phone": "9999900073",
    "take": 12500.0,
    "give": 0.0
  },
  {
    "name": "Saxena Cyber Cafe",
    "phone": "9999900074",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Choudhary Telecom Ajay",
    "phone": "9999900075",
    "take": 200.0,
    "give": 0.0
  },
  {
    "name": "Pnb 21-2030",
    "phone": "9999900076",
    "take": 233500.0,
    "give": 0.0
  },
  {
    "name": "Pending Qr",
    "phone": "9999900077",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "A S Computer Ashad Khan",
    "phone": "9999900078",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Noubhar Salahpur",
    "phone": "9999900079",
    "take": 186096.0,
    "give": 0.0
  },
  {
    "name": "Abhishek retailer reli pay",
    "phone": "9999900081",
    "take": 2484.0,
    "give": 0.0
  },
  {
    "name": "Dheeraj Tomar Reli Pay",
    "phone": "9999900082",
    "take": 418.0,
    "give": 0.0
  },
  {
    "name": "Nitish Bhati Reli Pay",
    "phone": "9999900083",
    "take": 429.0,
    "give": 0.0
  },
  {
    "name": "Aslam Bhai",
    "phone": "9999900084",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ashraf Bhai",
    "phone": "9999900085",
    "take": 0.0,
    "give": 300000.0
  },
  {
    "name": "Rohit Mobile Center",
    "phone": "9999900086",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Bharat Medical Store Indergarhi",
    "phone": "9999900087",
    "take": 2075.0,
    "give": 0.0
  },
  {
    "name": "Kamlesh & Co",
    "phone": "9871850900",
    "take": 0.0,
    "give": 2.0
  },
  {
    "name": "Shahzad Pnb Office Reli Pay",
    "phone": "9999900089",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Imran Medical Store Khichra",
    "phone": "9999900090",
    "take": 3163.0,
    "give": 0.0
  },
  {
    "name": "HIMALAYA",
    "phone": "9999900091",
    "take": 18329.0,
    "give": 0.0
  },
  {
    "name": "Do It Traders",
    "phone": "9999900092",
    "take": 27120.0,
    "give": 0.0
  },
  {
    "name": "Dushyant Satya Micro",
    "phone": "9999900093",
    "take": 683.0,
    "give": 0.0
  },
  {
    "name": "Ishaan Communication",
    "phone": "9999900094",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sachin Bhai Khichra",
    "phone": "9999900095",
    "take": 100000.0,
    "give": 0.0
  },
  {
    "name": "Master G Shakeel",
    "phone": "9999900096",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ahle Haq Sewa Kendra",
    "phone": "9999900097",
    "take": 6000.0,
    "give": 0.0
  },
  {
    "name": "Choudhary Communication Jahid Khan",
    "phone": "9999900099",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Bhiwania Telecom Lal Kua",
    "phone": "9999900100",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Vahid Sahid",
    "phone": "9999900101",
    "take": 0.0,
    "give": 425000.0
  },
  {
    "name": "Firoj Medical Store Nahal",
    "phone": "9999900102",
    "take": 1164.0,
    "give": 0.0
  },
  {
    "name": "Shiv Sakti Sanchar Hut",
    "phone": "9999900103",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Jani Satya Micro",
    "phone": "9999900104",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Yarana Tour",
    "phone": "9999900105",
    "take": 1861111.0,
    "give": 0.0
  },
  {
    "name": "A To Z All Net Services",
    "phone": "9310308799",
    "take": 147960.0,
    "give": 0.0
  },
  {
    "name": "New Bismillah Medical Store Masuri",
    "phone": "9999900107",
    "take": 0.0,
    "give": 6.0
  },
  {
    "name": "Yogindra reli pay retailer",
    "phone": "9999900108",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Hdfc Account",
    "phone": "9999900109",
    "take": 174144.0,
    "give": 0.0
  },
  {
    "name": "Anil G Gzb 1",
    "phone": "9999900110",
    "take": 5000.0,
    "give": 0.0
  },
  {
    "name": "Suspense",
    "phone": "9999900112",
    "take": 0.0,
    "give": 185252.0
  },
  {
    "name": "Bharat Medical Store Masuri",
    "phone": "9999900113",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "ANKIT BHAI LONI",
    "phone": "9999900114",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Tyagi Computer Point",
    "phone": "9999900115",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Namra Medical Store Dasna",
    "phone": "9999900116",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "G One Medical Store Dhabarsi",
    "phone": "9999900117",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Baba Medical Store Dasna",
    "phone": "9999900118",
    "take": 2008.0,
    "give": 0.0
  },
  {
    "name": "Ars Medical Store Nahal",
    "phone": "9999900119",
    "take": 4.0,
    "give": 0.0
  },
  {
    "name": "Saad Mobile Care",
    "phone": "9999900120",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shri Communication",
    "phone": "9999900121",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Mobile Repair Mansoor Masuri",
    "phone": "9999900122",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Noor Communication Pipleda",
    "phone": "9999900123",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Rizwan Retailer Paynearby",
    "phone": "9999900124",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ganganagar Satya Micro",
    "phone": "9999900125",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sabarwal G",
    "phone": "9999900126",
    "take": 27.0,
    "give": 0.0
  },
  {
    "name": "Saad Enterprises Masuri Store",
    "phone": "9999900127",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Nirbhay Insurance Centre",
    "phone": "9999900128",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "M R Money Transfer",
    "phone": "9999900129",
    "take": 13000.0,
    "give": 0.0
  },
  {
    "name": "Shadan Medical Store Dasna",
    "phone": "9999900130",
    "take": 0.0,
    "give": 2.0
  },
  {
    "name": "New Amit Medical Store Masuri",
    "phone": "9999900131",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shri Shyam Ajit Chaprula",
    "phone": "9999900132",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "New Choudhary Telecom Shyam",
    "phone": "9999900133",
    "take": 5420.0,
    "give": 0.0
  },
  {
    "name": "Shad Money Transfer",
    "phone": "9999900134",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sadik Medical Store Pipledha",
    "phone": "9999900136",
    "take": 345.0,
    "give": 0.0
  },
  {
    "name": "Medx Pharmacy Store Dasna",
    "phone": "9999900137",
    "take": 202.0,
    "give": 0.0
  },
  {
    "name": "Fahim Medical Store Nahal",
    "phone": "9999900138",
    "take": 22.0,
    "give": 0.0
  },
  {
    "name": "Janta Medical Store Pipledha",
    "phone": "9999900139",
    "take": 0.0,
    "give": 6.0
  },
  {
    "name": "Loan Shabnam Sister",
    "phone": "9999900140",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Family Care Store indergarhi",
    "phone": "9999900142",
    "take": 0.0,
    "give": 3.0
  },
  {
    "name": "Noor Mobile Shop Dasna",
    "phone": "9999900143",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Yogi 2",
    "phone": "9999900144",
    "take": 411.0,
    "give": 0.0
  },
  {
    "name": "Sana Medical Store Indergarhi",
    "phone": "9999900145",
    "take": 2000.0,
    "give": 0.0
  },
  {
    "name": "Shahnwaz ali Aizal MONEY TRANSFER",
    "phone": "9557995181",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Loan Muthoot",
    "phone": "9999900147",
    "take": 0.0,
    "give": 449053.0
  },
  {
    "name": "Azeem Medical Store Nahal",
    "phone": "9999900148",
    "take": 1628.0,
    "give": 0.0
  },
  {
    "name": "Mehrajpur Delhivery",
    "phone": "9999900150",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Short",
    "phone": "9999900151",
    "take": 177412.0,
    "give": 0.0
  },
  {
    "name": "Avval",
    "phone": "9999900152",
    "take": 5000.0,
    "give": 0.0
  },
  {
    "name": "Sbi Account Do It Services",
    "phone": "9999900153",
    "take": 14691.0,
    "give": 0.0
  },
  {
    "name": "Chintu Choudhary Money Transfer",
    "phone": "9999900155",
    "take": 12500.0,
    "give": 0.0
  },
  {
    "name": "Shri Radhe Radhe Com",
    "phone": "9999900156",
    "take": 7500.0,
    "give": 0.0
  },
  {
    "name": "Shanu Hasan Ali",
    "phone": "9999900157",
    "take": 2000.0,
    "give": 0.0
  },
  {
    "name": "Loan Lic",
    "phone": "9999900159",
    "take": 0.0,
    "give": 146000.0
  },
  {
    "name": "Jafer Khan Sbi Saving Account 7",
    "phone": "9999900160",
    "take": 10000.0,
    "give": 0.0
  },
  {
    "name": "Seema Pharmacy Store Indergadhi",
    "phone": "9999900161",
    "take": 804.0,
    "give": 0.0
  },
  {
    "name": "Db Yadav G del/gpm",
    "phone": "9999900162",
    "take": 56283.0,
    "give": 0.0
  },
  {
    "name": "S K Communication",
    "phone": "9999900164",
    "take": 24000.0,
    "give": 0.0
  },
  {
    "name": "Sonu",
    "phone": "9999900166",
    "take": 21000.0,
    "give": 0.0
  },
  {
    "name": "Mehmood Medical Store Pipledha",
    "phone": "9999900167",
    "take": 1536.0,
    "give": 0.0
  },
  {
    "name": "Gulzar Medical Store Masuri",
    "phone": "9999900168",
    "take": 1073.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retail K1 Pay",
    "phone": "9999900169",
    "take": 820.0,
    "give": 0.0
  },
  {
    "name": "Janta Medical Store Masuri",
    "phone": "9999900170",
    "take": 213.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Vidcom",
    "phone": "9999900171",
    "take": 1343.0,
    "give": 0.0
  },
  {
    "name": "Bilal Bhaiya",
    "phone": "9999900172",
    "take": 20000.0,
    "give": 0.0
  },
  {
    "name": "Vahid E Bill",
    "phone": "9999900173",
    "take": 17383.0,
    "give": 0.0
  },
  {
    "name": "Choudhary Telecom Manish",
    "phone": "9999900174",
    "take": 5150.0,
    "give": 0.0
  },
  {
    "name": "A K Pharmacy Store Indergarhi",
    "phone": "9999900175",
    "take": 345.0,
    "give": 0.0
  },
  {
    "name": "Manoj Telecom Tomar Photo And Mobile",
    "phone": "9999900176",
    "take": 200.0,
    "give": 0.0
  },
  {
    "name": "Rizwan Sikroda Store",
    "phone": "9999900177",
    "take": 0.0,
    "give": 17.0
  },
  {
    "name": "Gupta Cyber Point",
    "phone": "9999900178",
    "take": 2500.0,
    "give": 0.0
  },
  {
    "name": "Ajeet Himalaya",
    "phone": "9999900179",
    "take": 22907.0,
    "give": 0.0
  },
  {
    "name": "Mohd Aadil Railway Road Masuri",
    "phone": "9999900180",
    "take": 4100.0,
    "give": 0.0
  },
  {
    "name": "RC Medical Store Puthi mor Ankit",
    "phone": "9999900181",
    "take": 24.0,
    "give": 0.0
  },
  {
    "name": "Jafer Khan Retailer Airtel Payme",
    "phone": "9999900182",
    "take": 127.0,
    "give": 0.0
  },
  {
    "name": "Indian Cyber Advance",
    "phone": "9999900184",
    "take": 0.0,
    "give": 100000.0
  },
  {
    "name": "Noubhar Chouhan Communication",
    "phone": "9999900185",
    "take": 627.0,
    "give": 0.0
  },
  {
    "name": "Loan Bharti Axa",
    "phone": "9999900186",
    "take": 0.0,
    "give": 220935.0
  },
  {
    "name": "Device Booking",
    "phone": "9999900188",
    "take": 18123.0,
    "give": 0.0
  },
  {
    "name": "Iifl Gold Loan",
    "phone": "9999900189",
    "take": 0.0,
    "give": 509940.0
  },
  {
    "name": "Idresh Pharmacy Store Pipledha",
    "phone": "9999900190",
    "take": 1.0,
    "give": 0.0
  },
  {
    "name": "Rihan Medical Store Masuri",
    "phone": "9999900191",
    "take": 10.0,
    "give": 0.0
  },
  {
    "name": "Janta Medicose Store Indergarhi",
    "phone": "9999900192",
    "take": 2094.0,
    "give": 0.0
  },
  {
    "name": "Sayda Medical Store Pipledha",
    "phone": "9999900193",
    "take": 3060.0,
    "give": 0.0
  },
  {
    "name": "Grow Up Associate",
    "phone": "9999900194",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ali Cosmetic Dhaulana",
    "phone": "9999900195",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shri Ram Communication",
    "phone": "9999900196",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sakib Telecom",
    "phone": "9999900197",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Chouhan Communication Maruf",
    "phone": "9999900198",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Bala Ji Kirana Store",
    "phone": "9999900199",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Nice Computer Work",
    "phone": "9999900201",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Adil Communication",
    "phone": "9999900202",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Multi Banking Services",
    "phone": "9999900203",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Debt details",
    "phone": "9999900204",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "N.S. Communication Dasna",
    "phone": "9999900205",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Radhey Gift Galaxy Store",
    "phone": "9999900206",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shiv Medical Store Akash Nagar",
    "phone": "9999900207",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Samir Medical Store",
    "phone": "9999900208",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "New A One Mobile",
    "phone": "9999900209",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "The Mobile Care Mohseen Bayana",
    "phone": "9999900210",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sdm Mobile Point",
    "phone": "9999900211",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sagir Medical Store Masuri",
    "phone": "9999900212",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Kamal Medical Store Karim Nagar",
    "phone": "9999900213",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ram Sewa Medical Store Mishal Garhi",
    "phone": "9999900214",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Tyagi Medical Store",
    "phone": "9999900215",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Vedihi Mediworld Store",
    "phone": "9999900216",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Yadav Medical Store Govindpuram",
    "phone": "9999900217",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Mohan Ram Communication",
    "phone": "9999900218",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Malik Medical Store Masuri",
    "phone": "9999900219",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shifan Medical Store Pipledha",
    "phone": "9999900220",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Divya Online Services",
    "phone": "9999900221",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shubham Communication",
    "phone": "9999900222",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Jan Sewa Kendra Firoj",
    "phone": "9999900223",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Nazim Bhai Stationary",
    "phone": "9999900224",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Star Sudh Bhojnalaya",
    "phone": "9999900225",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Indian Medical Store Masuri",
    "phone": "9999900226",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Choudhary Mobile Repairing Ashok",
    "phone": "9999900227",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shrivastava Communication",
    "phone": "9999900228",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Abhay Online Services",
    "phone": "9999900229",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Madina Medical Store",
    "phone": "9999900230",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Som Medicose Store Jindal",
    "phone": "9999900231",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Anil G Noida Gur Lm1",
    "phone": "9999900232",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shiv Communication Jindal",
    "phone": "9999900233",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Kamil Bhaiya",
    "phone": "9999900234",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Adnan Mobile Repairing",
    "phone": "9999900235",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Rizwan Communication Retailer Imps Guru",
    "phone": "9999900236",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Cm Mobile Store",
    "phone": "9999900237",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Monika Beauty Parlour",
    "phone": "9999900238",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Health Care Store Dhaulana",
    "phone": "9999900239",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Naziya Medical Store Nahal",
    "phone": "9999900240",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sharma Medical Store Dasna",
    "phone": "9999900241",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Unique Mobile Hub Harish",
    "phone": "9999900242",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "ABS PHARMACY STORE DASNA",
    "phone": "9999900243",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Azeem Communication Office",
    "phone": "9999900244",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Amit Medical Store Masuri",
    "phone": "9999900245",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Adresh Communication",
    "phone": "9999900246",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Baba Medical Store Paynearby",
    "phone": "9999900247",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Mehraj Welcome Book Depot",
    "phone": "9999900248",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ajay Computer",
    "phone": "9999900249",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "S K Cyber Zone",
    "phone": "9999900250",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "T R Pharmacy Store",
    "phone": "9999900251",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Zubair Home",
    "phone": "9999900252",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Danish Malik Mobile",
    "phone": "9999900253",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Unique Mobile Nasrat",
    "phone": "9999900254",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Yashika Cosmetics",
    "phone": "9999900255",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sharma Telecom Santosh Kumar",
    "phone": "9999900256",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Javed Union Csc",
    "phone": "9999900257",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sehzan Telecom",
    "phone": "9999900258",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "All Mobile Solution Talib",
    "phone": "9999900259",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Vinay Communication",
    "phone": "9999900260",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Danish Saifi Computers And Service",
    "phone": "9999900261",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Asad Telecom",
    "phone": "9999900262",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Csc Online Centre",
    "phone": "9999900263",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Vishal Cafe 2",
    "phone": "9999900264",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shri Shyam Jam Sewa Kendra Ajeet",
    "phone": "9999900265",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Zama Zam Mobile Point Mohd Anas",
    "phone": "9999900266",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Vikas Rinova Portal Hasan Pur",
    "phone": "9999900267",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Lb Cyber Store",
    "phone": "9999900268",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Javed Home",
    "phone": "9999900269",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sameer Medical Store Dasna",
    "phone": "9999900270",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "S S K Communication Dhabarsi",
    "phone": "9999900271",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shifa Medical Store Dasna",
    "phone": "9999900272",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Raja Departmental Store",
    "phone": "9999900273",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Inaya Mobile Repair Irshad Ali",
    "phone": "9999900274",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Shree Ganesh Online Services",
    "phone": "9999900275",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "The Galaxy Photo Point Vipin",
    "phone": "9999900276",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Expenses Details",
    "phone": "9999900277",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Cyber Cafe Mohit Tushar",
    "phone": "9999900278",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Adeeba Comman Services Ashik",
    "phone": "9999900279",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Click Computer And Mobile Aasim Saifi",
    "phone": "9999900280",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sachin Nandgram",
    "phone": "9999900281",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Malik Mobile",
    "phone": "9999900282",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Durgesh Medical Store Indergarhi",
    "phone": "9999900283",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "S S Communication",
    "phone": "9999900284",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Health Care Masuri",
    "phone": "9999900285",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Sachin Kinapur Store",
    "phone": "9999900286",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Cm Mobile Point",
    "phone": "9999900289",
    "take": 0.0,
    "give": 0.0
  },
  {
    "name": "Ismail Rana Medical Store Dasna",
    "phone": "9999900290",
    "take": 0.0,
    "give": 0.0
  }
]


def run_reset_and_sync_for_db(db_name: str):
    print("=" * 65)
    print(f"🚀 Running Reset & 21-Sep Khatabook Sync on: {db_name}")
    print("=" * 65)
    
    tenant_url = get_tenant_connection_string(db_name)
    engine = create_engine(tenant_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        # 1. Clear all transactions and adjust foreign keys
        print("\n1. Deleting all transaction data...")
        db.execute(text("UPDATE collections SET mirror_deposit_id = NULL, online_routing_deposit_id = NULL"))
        den_count = db.query(Denomination).delete()
        base_count = db.query(DenominationBaseline).delete()
        led_count = db.query(Ledger).delete()
        coll_count = db.query(Collection).delete()
        dep_count = db.query(BankDeposit).delete()
        adj_count = db.query(PortalAdjustment).delete()
        att_count = db.query(Attendance).delete()
        db.flush()
        print(f"   Deleted: {coll_count} collections, {dep_count} deposits, {led_count} ledgers, {den_count} denominations, {adj_count} portal adjustments, {att_count} attendance records.")

        # 2. Reset User virtual balances and BusinessSettings
        print("\n2. Resetting user virtual balances & business settings...")
        users = db.query(User).all()
        for u in users:
            u.virtual_balance = Decimal("0")
        biz = db.query(BusinessSettings).first()
        if biz:
            biz.opening_cash_in_hand = 0.0
        print(f"   Reset {len(users)} users virtual balance and opening cash in hand.")

        # 3. Sync Portals and their Primary BankAccount
        print("\n3. Syncing Portals with 21-Sep Opening Balances...")
        existing_portals = db.query(Portal).all()
        portal_by_lower = {p.name.strip().lower(): p for p in existing_portals}

        # Reset all existing portals first
        for p in existing_portals:
            p.opening_to_take = Decimal("0")
            p.opening_to_give = Decimal("0")
            p.balance = Decimal("0")

        existing_bank_accounts = db.query(BankAccount).all()
        for ba in existing_bank_accounts:
            ba.opening_to_take = Decimal("0")
            ba.opening_to_give = Decimal("0")
            ba.balance = Decimal("0")
        db.flush()

        synced_portals = 0
        created_portals = 0

        for p_info in PORTALS_DATA:
            p_name = p_info['name'].strip()
            p_key = p_name.lower()
            p_take = Decimal(str(p_info['take']))
            p_give = Decimal(str(p_info['give']))
            # Portal balance convention: Assets - Liabilities (to_take - to_give)
            p_bal = p_take - p_give

            portal = portal_by_lower.get(p_key)
            # Match aliases if not found directly
            if not portal and p_key.startswith("portal "):
                portal = portal_by_lower.get(p_key[7:])
            if not portal and p_key.startswith("od "):
                portal = portal_by_lower.get(p_key[3:])

            if portal:
                portal.name = p_name
                portal.opening_to_take = p_take
                portal.opening_to_give = p_give
                portal.balance = p_bal
                synced_portals += 1
            else:
                portal = Portal(
                    name=p_name,
                    opening_to_take=p_take,
                    opening_to_give=p_give,
                    balance=p_bal
                )
                db.add(portal)
                db.flush()
                portal_by_lower[p_key] = portal
                created_portals += 1

            # Ensure primary BankAccount exists for this portal
            primary_account = db.query(BankAccount).filter(BankAccount.portal_id == portal.id).first()
            if not primary_account:
                primary_account = BankAccount(
                    portal_id=portal.id,
                    bank_account_name=f"{p_name} Primary",
                    bank_name="Default Bank",
                    bank_account_no=None,
                    ifsc_code=None,
                    show_in_online_payment=True,
                    opening_to_take=p_take,
                    opening_to_give=p_give,
                    balance=p_bal
                )
                db.add(primary_account)
            else:
                primary_account.opening_to_take = p_take
                primary_account.opening_to_give = p_give
                primary_account.balance = p_bal

        db.flush()
        print(f"   Portals updated: {synced_portals}, created: {created_portals} (Total in sync: {len(PORTALS_DATA)})")

        # 4. Remove Portal entries from Retailers table to avoid double-counting
        print("\n4. Cleaning up portal names from retailers table...")
        portal_name_keys = {p['name'].strip().lower() for p in PORTALS_DATA}
        # Do NOT delete CASH PORTAL from retailers
        portal_name_keys.discard("cash portal")

        existing_retailers = db.query(Retailer).all()
        removed_portal_dupes = 0
        for r in existing_retailers:
            if r.retailer_name.strip().lower() in portal_name_keys:
                db.delete(r)
                removed_portal_dupes += 1
        db.flush()
        print(f"   Removed {removed_portal_dupes} duplicate portal rows from retailers table.")

        # 5. Zero out any remaining retailers opening figures
        print("\n5. Resetting existing retailers...")
        all_retailers = db.query(Retailer).all()
        for r in all_retailers:
            r.opening_to_take = Decimal("0")
            r.opening_to_give = Decimal("0")
            r.balance = Decimal("0")
            r.opening_balance_set_on = None
        db.flush()

        # 6. Sync 268 Retailers (including CASH PORTAL)
        print("\n6. Syncing 268 Retailers (including CASH PORTAL) with 21-Sep Opening Balances...")
        all_retailers = db.query(Retailer).all()
        db_by_name = {r.retailer_name.strip().lower(): r for r in all_retailers}
        used_phones = {r.phone.strip() for r in all_retailers if r.phone}

        updated_ret = 0
        created_ret = 0

        for seed in RETAILERS_DATA:
            seed_name = seed['name'].strip()
            seed_key = seed_name.lower()
            seed_take = Decimal(str(seed['take']))
            seed_give = Decimal(str(seed['give']))

            target = db_by_name.get(seed_key)

            if target:
                target.retailer_name = seed_name
                target.opening_to_take = seed_take
                target.opening_to_give = seed_give
                target.opening_balance_set_on = TARGET_DATE
                target.balance = Decimal("0")
                target.is_active = True
                updated_ret += 1
            else:
                phone = seed['phone'].strip()
                while phone in used_phones:
                    phone = f"9{uuid.uuid4().hex[:9]}"
                used_phones.add(phone)

                new_r = Retailer(
                    retailer_name=seed_name,
                    phone=phone,
                    address="New Delhi",
                    opening_to_take=seed_take,
                    opening_to_give=seed_give,
                    balance=Decimal("0"),
                    opening_balance_set_on=TARGET_DATE,
                    is_active=True
                )
                db.add(new_r)
                db_by_name[seed_key] = new_r
                created_ret += 1

        db.flush()
        print(f"   Retailers updated: {updated_ret}, created: {created_ret}")

        # 7. Recalculate ledger balances for all active retailers
        print("\n7. Recalculating ledger balances for all active retailers...")
        active_retailers = db.query(Retailer).filter(Retailer.is_active == True).all()
        for r in active_retailers:
            recalculate_balances(r.id, db)
        db.commit()
        print(f"   Opening balance ledger entries generated for {len(active_retailers)} retailers.")

        # 8. Verification Report
        print("\n" + "=" * 65)
        print("VERIFICATION REPORT:")
        print("=" * 65)
        all_retailers = db.query(Retailer).all()
        all_portals = db.query(Portal).all()

        # In CrediiFlow:
        # Retailer balance > 0 means We Give (Liabilities)
        # Retailer balance < 0 means We Take / Get (Assets)
        ret_give = sum(float(r.balance) for r in all_retailers if r.balance > 0)
        ret_take = sum(float(-r.balance) for r in all_retailers if r.balance < 0)

        # Portal balance > 0 means We Take / Assets in portal
        # Portal balance < 0 means We Give / OD in portal
        p_take = sum(float(p.balance) for p in all_portals if p.balance > 0)
        p_give = sum(float(-p.balance) for p in all_portals if p.balance < 0)

        total_give = ret_give + p_give
        total_take = ret_take + p_take

        khatabook_target = 7754555.00

        print(f"Retailer Balances: You will give: Rs {ret_give:,.2f} | You will get: Rs {ret_take:,.2f}")
        print(f"Portal Balances:   You will give: Rs {p_give:,.2f} | You will get: Rs {p_take:,.2f}")
        print(f"TOTAL DASHBOARD:   You will give: Rs {total_give:,.2f} | You will get: Rs {total_take:,.2f}")
        print(f"KHATABOOK TARGET:  You will give: Rs {khatabook_target:,.2f} | You will get: Rs {khatabook_target:,.2f}")
        print(f"Net Balance:       Rs {total_give - total_take:,.2f}")
        print(f"Date set on all:   {TARGET_DATE}")

        give_match = abs(total_give - khatabook_target) < 0.01
        take_match = abs(total_take - khatabook_target) < 0.01

        if give_match and take_match:
            print("\n🎉 100% PERFECT MATCH WITH KHATABOOK 21-SEP REPORT!")
        else:
            print(f"\n⚠️ MISMATCH: Give diff={total_give - khatabook_target}, Take diff={total_take - khatabook_target}")

        return {
            "success": give_match and take_match,
            "total_give": total_give,
            "total_take": total_take,
            "updated_retailers": updated_ret,
            "created_retailers": created_ret,
            "synced_portals": synced_portals + created_portals
        }

    except Exception as e:
        db.rollback()
        print(f"Error in reset_and_sync on {db_name}: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()
        engine.dispose()


def main():
    target_dbs = []
    if len(sys.argv) > 1:
        target_dbs = sys.argv[1:]
    else:
        # Resolve active tenants from Master DB
        try:
            master_db = MasterSessionLocal()
            tenants = master_db.query(Tenant).filter(Tenant.status == 'active').all()
            for t in tenants:
                if t.subdomain in ('do-it-services', 'hello', 'do-it') or 'doit' in t.db_name or 'hello' in t.db_name:
                    if t.db_name not in target_dbs:
                        target_dbs.append(t.db_name)
            master_db.close()
        except Exception as e:
            print(f"Could not query master db: {e}")

    if not target_dbs:
        target_dbs = ['crediiflow_hello', 'crediiflow_do_it_services', 'doit_production']

    print(f"Target tenant databases for 21-Sep reset: {target_dbs}")
    for db_name in target_dbs:
        try:
            run_reset_and_sync_for_db(db_name)
        except Exception as e:
            print(f"Failed on {db_name}: {e}")


if __name__ == '__main__':
    main()
