#!/usr/bin/env python3

import asyncio
import aiohttp
import json
import sys
from typing import Dict, List, Any
from datetime import datetime, timezone

class Phase2ERPTester:
    def __init__(self, base_url: str = "https://pdf-auth-fix-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.token = None
        self.session = None
        self.test_results = []
        
        # Test data storage
        self.created_garment_id = None
        self.created_product_id = None
        self.created_variant_id = None
        self.created_po_id = None
        self.created_po_item_id = None
        self.created_vendor_shipment_id = None
        self.created_production_job_id = None

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(verify_ssl=False)
        )
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if response_data and isinstance(response_data, dict):
            result["response_snippet"] = str(response_data)[:200] + "..." if len(str(response_data)) > 200 else str(response_data)
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name}: {details}")
        if response_data and not success:
            print(f"     Response: {response_data}")

    async def make_request(self, method: str, endpoint: str, data: dict = None, headers: dict = None) -> tuple[bool, dict]:
        """Make HTTP request and return (success, response_data)"""
        url = f"{self.api_url}/{endpoint.lstrip('/')}"
        request_headers = {}
        
        if self.token:
            request_headers["Authorization"] = f"Bearer {self.token}"
        if headers:
            request_headers.update(headers)
        
        request_headers["Content-Type"] = "application/json"
        
        try:
            async with self.session.request(method, url, headers=request_headers, json=data if data else None) as response:
                try:
                    response_data = await response.json()
                except:
                    response_data = {"text": await response.text()}
                
                return response.status < 400, {
                    "status": response.status,
                    "data": response_data
                }
        except Exception as e:
            return False, {"error": str(e)}

    async def login_superadmin(self) -> bool:
        """Login as superadmin"""
        print("🔐 Logging in as superadmin...")
        success, response = await self.make_request("POST", "auth/login", {
            "email": "admin@garment.com",
            "password": "Admin@123"
        })
        
        if success and "data" in response and "token" in response["data"]:
            self.token = response["data"]["token"]
            self.log_result("Admin Login", True, "Successfully logged in as superadmin")
            return True
        else:
            self.log_result("Admin Login", False, f"Login failed: {response}")
            return False

    async def setup_test_data(self) -> bool:
        """Create necessary test data for Phase 2 features"""
        print("🔧 Setting up test data...")
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Create garment/vendor
        garment_data = {
            "garment_name": f"Phase2 Test Vendor {timestamp}",
            "garment_code": f"P2V{timestamp}",
            "location": "Jakarta",
            "monthly_capacity": 5000,
            "contact_person": "Phase2 Tester"
        }
        
        success, garment_response = await self.make_request("POST", "garments", garment_data)
        if not success:
            self.log_result("Setup - Garment Creation", False, f"Could not create garment: {garment_response}")
            return False
        
        self.created_garment_id = garment_response["data"]["id"]
        
        # Create product
        product_data = {
            "product_name": f"Phase2 Test Product {timestamp}",
            "product_code": f"P2P{timestamp}",
            "cmt_price": 50000,
            "selling_price": 120000
        }
        
        success, product_response = await self.make_request("POST", "products", product_data)
        if not success:
            self.log_result("Setup - Product Creation", False, f"Could not create product: {product_response}")
            return False
        
        self.created_product_id = product_response["data"]["id"]
        
        # Create variant
        variant_data = {
            "product_id": self.created_product_id,
            "size": "L",
            "color": "Navy",
            "sku": f"P2P{timestamp}-NAV-L"
        }
        
        success, variant_response = await self.make_request("POST", "product-variants", variant_data)
        if not success:
            self.log_result("Setup - Variant Creation", False, f"Could not create variant: {variant_response}")
            return False
        
        self.created_variant_id = variant_response["data"]["id"]
        
        # Create PO
        po_data = {
            "po_number": f"P2-TEST-PO-{timestamp}",
            "customer_name": "Phase2 Test Customer",
            "vendor_id": self.created_garment_id,
            "deadline": "2025-12-31",
            "delivery_deadline": "2025-12-25",
            "items": [{
                "product_id": self.created_product_id,
                "variant_id": self.created_variant_id,
                "qty": 100,
                "selling_price_snapshot": 120000,
                "cmt_price_snapshot": 50000
            }]
        }
        
        success, po_response = await self.make_request("POST", "production-pos", po_data)
        if not success:
            self.log_result("Setup - PO Creation", False, f"Could not create PO: {po_response}")
            return False
        
        self.created_po_id = po_response["data"]["id"]
        self.created_po_item_id = po_response["data"]["items"][0]["id"]
        
        # Create vendor shipment
        vendor_shipment_data = {
            "shipment_number": f"P2-VSHIP-{timestamp}",
            "vendor_id": self.created_garment_id,
            "shipment_date": "2025-01-15",
            "delivery_note_number": f"DN-P2-{timestamp}",
            "items": [{
                "po_id": self.created_po_id,
                "po_item_id": self.created_po_item_id,
                "product_name": f"Phase2 Test Product {timestamp}",
                "qty_sent": 100
            }]
        }
        
        success, vs_response = await self.make_request("POST", "vendor-shipments", vendor_shipment_data)
        if not success:
            self.log_result("Setup - Vendor Shipment Creation", False, f"Could not create vendor shipment: {vs_response}")
            return False
        
        self.created_vendor_shipment_id = vs_response["data"]["id"]
        
        # Create production job
        production_job_data = {
            "vendor_shipment_id": self.created_vendor_shipment_id,
            "job_number": f"JOB-P2-{timestamp}",
            "notes": "Phase 2 test production job"
        }
        
        success, job_response = await self.make_request("POST", "production-jobs", production_job_data)
        if success:
            self.created_production_job_id = job_response["data"]["id"]
        
        self.log_result("Setup Test Data", True, "All test data created successfully")
        return True

    async def test_1_auto_vendor_invoice_creation(self) -> bool:
        """Test 1: Auto Vendor Invoice Creation on Vendor Shipment"""
        print("\n💰 Testing Auto Vendor Invoice Creation...")
        
        # Check if vendor invoice was auto-created during setup
        success, response = await self.make_request("GET", "invoices?type=vendor")
        if not success:
            self.log_result("Auto Vendor Invoice - GET Failed", False, f"Could not get vendor invoices: {response}")
            return False
        
        vendor_invoices = response["data"]
        
        # Find invoice related to our vendor shipment
        matching_invoice = None
        for invoice in vendor_invoices:
            if invoice.get("shipment_id") == self.created_vendor_shipment_id:
                matching_invoice = invoice
                break
        
        if not matching_invoice:
            self.log_result("Auto Vendor Invoice - Not Found", False, "No vendor invoice auto-created for vendor shipment")
            return False
        
        # Validate invoice properties
        expected_props = ["invoice_type", "status", "total_amount", "shipment_number", "vendor_id"]
        missing_props = [prop for prop in expected_props if prop not in matching_invoice]
        
        if missing_props:
            self.log_result("Auto Vendor Invoice - Missing Props", False, f"Missing properties: {missing_props}")
            return False
        
        # Validate invoice type and status
        if matching_invoice["invoice_type"] != "vendor":
            self.log_result("Auto Vendor Invoice - Wrong Type", False, f"Expected type 'vendor', got: {matching_invoice['invoice_type']}")
            return False
        
        if matching_invoice["status"] != "Draft":
            self.log_result("Auto Vendor Invoice - Wrong Status", False, f"Expected status 'Draft', got: {matching_invoice['status']}")
            return False
        
        # Check if total amount is calculated from CMT prices
        expected_amount = 100 * 50000  # qty * cmt_price from setup
        if matching_invoice["total_amount"] == expected_amount:
            self.log_result("Auto Vendor Invoice Creation", True, f"✅ Vendor invoice auto-created: {matching_invoice['invoice_number']}, amount: {expected_amount}")
            return True
        else:
            self.log_result("Auto Vendor Invoice - Wrong Amount", False, f"Expected amount: {expected_amount}, got: {matching_invoice['total_amount']}")
            return False

    async def test_2_cumulative_buyer_shipment(self) -> bool:
        """Test 2: Cumulative Buyer Shipment (Multi-Dispatch)"""
        print("\n🚚 Testing Cumulative Buyer Shipment...")
        
        if not self.created_production_job_id:
            self.log_result("Buyer Shipment - No Production Job", False, "Production job not created in setup")
            return False
        
        # Create production progress first (simulate production completion)
        success, job_items_response = await self.make_request("GET", f"production-job-items?job_id={self.created_production_job_id}")
        if not success or not job_items_response["data"]:
            self.log_result("Buyer Shipment - No Job Items", False, "Could not get production job items")
            return False
        
        job_item_id = job_items_response["data"][0]["id"]
        
        # Add production progress
        progress_data = {
            "job_item_id": job_item_id,
            "quantity": 100,
            "progress_date": "2025-01-20",
            "notes": "Completed production for buyer shipment test"
        }
        
        success, progress_response = await self.make_request("POST", "production-progress", progress_data)
        if not success:
            self.log_result("Buyer Shipment - Progress Failed", False, f"Could not create production progress: {progress_response}")
            return False
        
        timestamp = datetime.now().strftime('%H%M%S')
        
        # First buyer shipment (partial)
        buyer_shipment_1_data = {
            "shipment_number": f"BS-P2-1-{timestamp}",
            "job_id": self.created_production_job_id,
            "vendor_id": self.created_garment_id,
            "shipment_date": "2025-01-22",
            "customer_name": "Phase2 Customer",
            "items": [{
                "job_item_id": job_item_id,
                "product_name": "Phase2 Test Product",
                "ordered_qty": 100,
                "qty_shipped": 50  # Partial shipment
            }]
        }
        
        success, bs1_response = await self.make_request("POST", "buyer-shipments", buyer_shipment_1_data)
        if not success:
            self.log_result("Cumulative Buyer Shipment - First Failed", False, f"Could not create first buyer shipment: {bs1_response}")
            return False
        
        # Validate first shipment
        if bs1_response["status"] != 201:
            self.log_result("Cumulative Buyer Shipment - Wrong Status 1", False, f"Expected status 201, got: {bs1_response['status']}")
            return False
        
        first_shipment = bs1_response["data"]
        if first_shipment["ship_status"] not in ["Partially Shipped", "Fully Shipped"]:
            self.log_result("Cumulative Buyer Shipment - Wrong Ship Status 1", False, f"Expected 'Partially Shipped', got: {first_shipment['ship_status']}")
            return False
        
        if first_shipment["dispatch_seq"] != 1:
            self.log_result("Cumulative Buyer Shipment - Wrong Dispatch Seq 1", False, f"Expected dispatch_seq 1, got: {first_shipment['dispatch_seq']}")
            return False
        
        shipment_id = first_shipment["id"]
        
        # Second buyer shipment (same job_id, should be continuation)
        buyer_shipment_2_data = {
            "shipment_number": f"BS-P2-2-{timestamp}",
            "job_id": self.created_production_job_id,  # Same job_id
            "vendor_id": self.created_garment_id,
            "shipment_date": "2025-01-25",
            "customer_name": "Phase2 Customer",
            "items": [{
                "job_item_id": job_item_id,
                "product_name": "Phase2 Test Product",
                "ordered_qty": 100,
                "qty_shipped": 50  # Remaining quantity
            }]
        }
        
        success, bs2_response = await self.make_request("POST", "buyer-shipments", buyer_shipment_2_data)
        if not success:
            self.log_result("Cumulative Buyer Shipment - Second Failed", False, f"Could not create second buyer shipment: {bs2_response}")
            return False
        
        # Validate second shipment (should be continuation)
        if bs2_response["status"] != 200:
            self.log_result("Cumulative Buyer Shipment - Wrong Status 2", False, f"Expected status 200 (continuation), got: {bs2_response['status']}")
            return False
        
        second_shipment = bs2_response["data"]
        if second_shipment["dispatch_seq"] != 2:
            self.log_result("Cumulative Buyer Shipment - Wrong Dispatch Seq 2", False, f"Expected dispatch_seq 2, got: {second_shipment['dispatch_seq']}")
            return False
        
        # Check that GET /api/buyer-shipments shows only 1 master record
        success, get_response = await self.make_request("GET", "buyer-shipments")
        if not success:
            self.log_result("Cumulative Buyer Shipment - GET Failed", False, f"Could not get buyer shipments: {get_response}")
            return False
        
        job_shipments = [bs for bs in get_response["data"] if bs.get("job_id") == self.created_production_job_id]
        if len(job_shipments) != 1:
            self.log_result("Cumulative Buyer Shipment - Multiple Masters", False, f"Expected 1 master record, found: {len(job_shipments)}")
            return False
        
        self.log_result("Cumulative Buyer Shipment", True, f"✅ Multi-dispatch working: First dispatch (201), Second dispatch (200), Only 1 master record")
        return True

    async def test_3_production_monitoring_v2(self) -> bool:
        """Test 3: Production Monitoring v2"""
        print("\n📊 Testing Production Monitoring v2...")
        
        success, response = await self.make_request("GET", "production-monitoring-v2")
        if not success:
            self.log_result("Production Monitoring v2 - GET Failed", False, f"Could not get monitoring data: {response}")
            return False
        
        monitoring_data = response["data"]
        
        # Response should be an array of vendors
        if not isinstance(monitoring_data, list):
            self.log_result("Production Monitoring v2 - Wrong Type", False, f"Expected array, got: {type(monitoring_data)}")
            return False
        
        # If there are vendors, check structure
        if monitoring_data:
            sample_vendor = monitoring_data[0]
            expected_fields = ["total_jobs", "jobs_by_status", "total_qty", "total_produced", "total_shipped", "progress_pct", "performance", "jobs"]
            
            missing_fields = []
            for field in expected_fields:
                if field not in sample_vendor:
                    missing_fields.append(field)
            
            if missing_fields:
                self.log_result("Production Monitoring v2 - Missing Fields", False, f"Missing fields: {missing_fields}")
                return False
            
            # Check jobs_by_status structure
            if "in_progress" not in sample_vendor["jobs_by_status"] or "completed" not in sample_vendor["jobs_by_status"]:
                self.log_result("Production Monitoring v2 - Wrong Status Structure", False, "jobs_by_status should have 'in_progress' and 'completed'")
                return False
            
            # Check jobs array structure
            if sample_vendor["jobs"] and isinstance(sample_vendor["jobs"], list):
                sample_job = sample_vendor["jobs"][0]
                job_expected_fields = ["ordered_qty", "produced_qty", "shipped_qty"]
                job_missing_fields = [field for field in job_expected_fields if field not in sample_job]
                
                if job_missing_fields:
                    self.log_result("Production Monitoring v2 - Wrong Job Structure", False, f"Jobs missing fields: {job_missing_fields}")
                    return False
            
            # Verify it does NOT reference work_orders anymore (check field names)
            monitoring_str = json.dumps(monitoring_data)
            if "work_order" in monitoring_str.lower():
                self.log_result("Production Monitoring v2 - Still Uses Work Orders", False, "Response still references work_orders")
                return False
        
        self.log_result("Production Monitoring v2", True, f"✅ Correct structure, {len(monitoring_data)} vendors with production data")
        return True

    async def test_4_buyer_shipment_dispatches_endpoint(self) -> bool:
        """Test 4: Buyer-Shipment-Dispatches Endpoint"""
        print("\n📋 Testing Buyer-Shipment-Dispatches Endpoint...")
        
        # Find a buyer shipment with dispatches from our test data
        success, shipments_response = await self.make_request("GET", "buyer-shipments")
        if not success or not shipments_response["data"]:
            self.log_result("Buyer Dispatches - No Shipments", False, "No buyer shipments found to test dispatches")
            return False
        
        # Find our test shipment
        test_shipment = None
        for shipment in shipments_response["data"]:
            if shipment.get("job_id") == self.created_production_job_id:
                test_shipment = shipment
                break
        
        if not test_shipment:
            self.log_result("Buyer Dispatches - No Test Shipment", False, "Could not find test shipment for dispatches")
            return False
        
        shipment_id = test_shipment["id"]
        
        # GET buyer-shipment-dispatches
        success, dispatches_response = await self.make_request("GET", f"buyer-shipment-dispatches?shipment_id={shipment_id}")
        if not success:
            self.log_result("Buyer Dispatches - GET Failed", False, f"Could not get dispatches: {dispatches_response}")
            return False
        
        dispatches = dispatches_response["data"]
        
        # Validate response is array
        if not isinstance(dispatches, list):
            self.log_result("Buyer Dispatches - Wrong Type", False, f"Expected array, got: {type(dispatches)}")
            return False
        
        # If we have dispatches, validate structure
        if dispatches:
            sample_dispatch = dispatches[0]
            expected_fields = ["dispatch_seq", "dispatch_date", "items", "total_qty"]
            missing_fields = [field for field in expected_fields if field not in sample_dispatch]
            
            if missing_fields:
                self.log_result("Buyer Dispatches - Missing Fields", False, f"Missing fields in dispatch: {missing_fields}")
                return False
            
            # Check if dispatches are properly grouped by dispatch_seq
            dispatch_seqs = [d["dispatch_seq"] for d in dispatches]
            if len(set(dispatch_seqs)) != len(dispatch_seqs):
                self.log_result("Buyer Dispatches - Duplicate Seq", False, "Dispatches not properly grouped by sequence")
                return False
        
        self.log_result("Buyer-Shipment-Dispatches Endpoint", True, f"✅ Endpoint working, returned {len(dispatches)} dispatch groups")
        return True

    async def test_5_auto_customer_invoice_creation(self) -> bool:
        """Test 5: Auto Customer Invoice Creation on Buyer Shipment"""
        print("\n💳 Testing Auto Customer Invoice Creation...")
        
        # Check customer invoices
        success, response = await self.make_request("GET", "invoices?type=customer")
        if not success:
            self.log_result("Auto Customer Invoice - GET Failed", False, f"Could not get customer invoices: {response}")
            return False
        
        customer_invoices = response["data"]
        
        # Find invoices for our test job/shipments
        matching_invoices = []
        for invoice in customer_invoices:
            # Check if this invoice is related to our test data (could be by job_id or shipment_id)
            if (invoice.get("garment_id") == self.created_garment_id or 
                "P2" in invoice.get("invoice_number", "") or
                "Phase2" in str(invoice)):
                matching_invoices.append(invoice)
        
        if not matching_invoices:
            self.log_result("Auto Customer Invoice - Not Found", False, "No customer invoice auto-created for buyer shipments")
            return False
        
        # Validate at least one customer invoice
        invoice = matching_invoices[0]
        
        # Check required fields
        if invoice.get("invoice_type") != "customer":
            self.log_result("Auto Customer Invoice - Wrong Type", False, f"Expected type 'customer', got: {invoice.get('invoice_type')}")
            return False
        
        if invoice.get("status") != "Unpaid":
            self.log_result("Auto Customer Invoice - Wrong Status", False, f"Expected status 'Unpaid', got: {invoice.get('status')}")
            return False
        
        # Check if selling price is used (should be > 0 for our test data)
        if invoice.get("total_amount", 0) <= 0:
            self.log_result("Auto Customer Invoice - Zero Amount", False, f"Expected amount > 0, got: {invoice.get('total_amount')}")
            return False
        
        self.log_result("Auto Customer Invoice Creation", True, f"✅ Customer invoice auto-created: {invoice['invoice_number']}, status: Unpaid")
        return True

    async def test_6_invoices_type_filter(self) -> bool:
        """Test 6: GET /api/invoices with type filter"""
        print("\n🔍 Testing Invoices Type Filter...")
        
        # Test vendor filter
        success, vendor_response = await self.make_request("GET", "invoices?type=vendor")
        if not success:
            self.log_result("Invoice Type Filter - Vendor Failed", False, f"Could not get vendor invoices: {vendor_response}")
            return False
        
        vendor_invoices = vendor_response["data"]
        
        # Validate all are vendor type
        for invoice in vendor_invoices:
            if invoice.get("invoice_type") != "vendor":
                self.log_result("Invoice Type Filter - Wrong Vendor Type", False, f"Found non-vendor invoice in vendor filter: {invoice.get('invoice_type')}")
                return False
        
        # Test customer filter
        success, customer_response = await self.make_request("GET", "invoices?type=customer")
        if not success:
            self.log_result("Invoice Type Filter - Customer Failed", False, f"Could not get customer invoices: {customer_response}")
            return False
        
        customer_invoices = customer_response["data"]
        
        # Validate all are customer type
        for invoice in customer_invoices:
            if invoice.get("invoice_type") != "customer":
                self.log_result("Invoice Type Filter - Wrong Customer Type", False, f"Found non-customer invoice in customer filter: {invoice.get('invoice_type')}")
                return False
        
        # Test no filter (should return all)
        success, all_response = await self.make_request("GET", "invoices")
        if not success:
            self.log_result("Invoice Type Filter - All Failed", False, f"Could not get all invoices: {all_response}")
            return False
        
        all_invoices = all_response["data"]
        
        # Verify counts make sense
        total_filtered = len(vendor_invoices) + len(customer_invoices)
        if len(all_invoices) < total_filtered:
            self.log_result("Invoice Type Filter - Count Mismatch", False, f"All invoices ({len(all_invoices)}) < filtered total ({total_filtered})")
            return False
        
        self.log_result("Invoices Type Filter", True, f"✅ Filters working: {len(vendor_invoices)} vendor, {len(customer_invoices)} customer, {len(all_invoices)} total")
        return True

    async def run_phase2_tests(self):
        """Run all Phase 2 backend tests"""
        print("🚀 Starting Phase 2 Backend Feature Tests\n")
        print("=" * 70)
        
        # Login first
        if not await self.login_superadmin():
            print("❌ Cannot continue without valid login")
            return False
        
        # Setup test data
        if not await self.setup_test_data():
            print("❌ Cannot continue without test data setup")
            return False
        
        # Run all Phase 2 tests
        test_functions = [
            self.test_1_auto_vendor_invoice_creation,
            self.test_2_cumulative_buyer_shipment,
            self.test_3_production_monitoring_v2,
            self.test_4_buyer_shipment_dispatches_endpoint,
            self.test_5_auto_customer_invoice_creation,
            self.test_6_invoices_type_filter
        ]
        
        passed = 0
        total = len(test_functions)
        
        for test_func in test_functions:
            try:
                if await test_func():
                    passed += 1
            except Exception as e:
                self.log_result(test_func.__name__, False, f"Test threw exception: {str(e)}")
                print(f"Exception in {test_func.__name__}: {e}")
        
        # Print summary
        print("\n" + "=" * 70)
        print(f"🏁 Phase 2 Test Summary: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
        print("=" * 70)
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if not r["success"]]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for fail in failed_tests:
                print(f"   • {fail['test']}: {fail['details']}")
        
        print(f"\n✅ Passed Tests ({passed}):")
        passed_tests = [r for r in self.test_results if r["success"]]
        for pass_test in passed_tests:
            print(f"   • {pass_test['test']}: {pass_test['details']}")
        
        return passed == total

async def main():
    async with Phase2ERPTester() as tester:
        success = await tester.run_phase2_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())