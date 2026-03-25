#!/usr/bin/env python3

import asyncio
import aiohttp
import json
import sys
from typing import Dict, List, Any
from datetime import datetime, timezone

class ProductionFlowTester:
    def __init__(self, base_url: str = "https://pdf-auth-fix-2.preview.emergentagent.com"):
        self.base_url = base_url.rstrip('/')
        self.api_url = f"{self.base_url}/api"
        self.token = None
        self.session = None
        self.test_results = []
        
        # Test data storage
        self.vendor_id = None
        self.product_id = None
        self.variant_id = None
        self.po_id = None
        self.po_item_id = None
        self.vendor_shipment_id = None
        self.production_job_id = None
        self.job_item_id = None

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
        
        if method.upper() == "GET":
            request_headers["Content-Type"] = "application/json"
        else:
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
        """Create test data: garment, product, variant, PO, vendor shipment"""
        print("\n🏗️ Setting up test data...")
        timestamp = datetime.now().strftime('%H%M%S')
        
        # Create vendor
        garment_data = {
            "garment_name": f"Production Flow Vendor {timestamp}",
            "garment_code": f"PFV{timestamp}",
            "location": "Jakarta",
            "monthly_capacity": 5000,
            "contact_person": "Production Manager"
        }
        
        success, response = await self.make_request("POST", "garments", garment_data)
        if not success:
            self.log_result("Setup - Create Vendor", False, f"Failed: {response}")
            return False
        
        self.vendor_id = response["data"]["id"]
        self.log_result("Setup - Create Vendor", True, f"Created vendor: {self.vendor_id}")
        
        # Create product
        product_data = {
            "product_name": f"Production Flow Product {timestamp}",
            "product_code": f"PFP{timestamp}",
            "cmt_price": 50000,
            "selling_price": 85000
        }
        
        success, response = await self.make_request("POST", "products", product_data)
        if not success:
            self.log_result("Setup - Create Product", False, f"Failed: {response}")
            return False
        
        self.product_id = response["data"]["id"]
        self.log_result("Setup - Create Product", True, f"Created product: {self.product_id}")
        
        # Create variant
        variant_data = {
            "product_id": self.product_id,
            "size": "L",
            "color": "Navy",
            "sku": f"PFP{timestamp}-NAV-L"
        }
        
        success, response = await self.make_request("POST", "product-variants", variant_data)
        if not success:
            self.log_result("Setup - Create Variant", False, f"Failed: {response}")
            return False
        
        self.variant_id = response["data"]["id"]
        self.log_result("Setup - Create Variant", True, f"Created variant: {self.variant_id}")
        
        # Create PO
        po_data = {
            "po_number": f"PF-PO-{timestamp}",
            "customer_name": "Production Flow Customer",
            "vendor_id": self.vendor_id,
            "deadline": "2025-12-31",
            "delivery_deadline": "2025-12-25",
            "items": [{
                "product_id": self.product_id,
                "variant_id": self.variant_id,
                "qty": 100,
                "selling_price_snapshot": 85000,
                "cmt_price_snapshot": 50000
            }]
        }
        
        success, response = await self.make_request("POST", "production-pos", po_data)
        if not success:
            self.log_result("Setup - Create PO", False, f"Failed: {response}")
            return False
        
        self.po_id = response["data"]["id"]
        self.po_item_id = response["data"]["items"][0]["id"]
        self.log_result("Setup - Create PO", True, f"Created PO: {self.po_id} with item: {self.po_item_id}")
        
        # Create vendor shipment
        shipment_data = {
            "shipment_number": f"PF-SHIP-{timestamp}",
            "vendor_id": self.vendor_id,
            "shipment_date": "2025-01-01",
            "items": [{
                "po_id": self.po_id,
                "po_item_id": self.po_item_id,
                "product_name": f"Production Flow Product {timestamp}",
                "qty_sent": 100
            }]
        }
        
        success, response = await self.make_request("POST", "vendor-shipments", shipment_data)
        if not success:
            self.log_result("Setup - Create Vendor Shipment", False, f"Failed: {response}")
            return False
        
        self.vendor_shipment_id = response["data"]["id"]
        self.log_result("Setup - Create Vendor Shipment", True, f"Created vendor shipment: {self.vendor_shipment_id}")
        
        # Update vendor shipment status to "Received"
        update_data = {"status": "Received"}
        success, response = await self.make_request("PUT", f"vendor-shipments/{self.vendor_shipment_id}", update_data)
        if not success:
            self.log_result("Setup - Update Shipment to Received", False, f"Failed: {response}")
            return False
        
        self.log_result("Setup - Update Shipment to Received", True, "Shipment status updated to Received")
        
        return True

    async def test_1_distribusi_kerja_autopopulated(self) -> bool:
        """Test 1: Distribusi Kerja (auto-populated) - GET /api/distribusi-kerja"""
        print("\n📋 Test 1: Distribusi Kerja Auto-populated...")
        
        success, response = await self.make_request("GET", "distribusi-kerja")
        if not success:
            self.log_result("Test 1 - Distribusi Kerja", False, f"GET failed: {response}")
            return False
        
        data = response["data"]
        if not isinstance(data, list):
            self.log_result("Test 1 - Distribusi Kerja", False, f"Expected array, got: {type(data)}")
            return False
        
        if len(data) == 0:
            self.log_result("Test 1 - Distribusi Kerja", True, "Empty array returned (no shipment items yet)")
            return True
        
        # Check structure of first item
        item = data[0]
        expected_fields = [
            "shipment_number", "po_number", "vendor_name", "sku", 
            "ordered_qty", "shipment_qty", "produced_qty", "shipped_qty",
            "remaining_production", "progress_pct", "po_status"
        ]
        
        missing_fields = [field for field in expected_fields if field not in item]
        if missing_fields:
            self.log_result("Test 1 - Distribusi Kerja", False, f"Missing fields: {missing_fields}")
            return False
        
        self.log_result("Test 1 - Distribusi Kerja", True, f"Auto-populated with {len(data)} items, correct structure")
        return True

    async def test_2_production_job_creation(self) -> bool:
        """Test 2: Production Jobs — Create (vendor flow)"""
        print("\n🔧 Test 2: Production Job Creation (Vendor Flow)...")
        
        # First find a vendor
        success, response = await self.make_request("GET", "garments")
        if not success:
            self.log_result("Test 2 - Get Vendors", False, f"Failed: {response}")
            return False
        
        if not response["data"]:
            self.log_result("Test 2 - Get Vendors", False, "No vendors found")
            return False
        
        vendor = response["data"][0]
        vendor_id = vendor["id"]
        self.log_result("Test 2 - Get Vendors", True, f"Found vendor: {vendor['garment_name']}")
        
        # Get received vendor shipment
        success, response = await self.make_request("GET", "vendor-shipments")
        if not success:
            self.log_result("Test 2 - Get Shipments", False, f"Failed: {response}")
            return False
        
        received_shipment = None
        for shipment in response["data"]:
            if shipment["status"] == "Received":
                received_shipment = shipment
                break
        
        if not received_shipment:
            # No received shipment found, try to update our test shipment to received
            if not self.vendor_shipment_id:
                self.log_result("Test 2 - Find Received Shipment", False, "No received shipments and no test shipment created")
                return False
            
            received_shipment_id = self.vendor_shipment_id
        else:
            received_shipment_id = received_shipment["id"]
        
        self.log_result("Test 2 - Find Received Shipment", True, f"Using shipment: {received_shipment_id}")
        
        # Create production job
        job_data = {
            "vendor_shipment_id": received_shipment_id,
            "vendor_id": vendor_id,
            "notes": "Production flow test job"
        }
        
        success, response = await self.make_request("POST", "production-jobs", job_data)
        if not success:
            self.log_result("Test 2 - Create Production Job", False, f"Failed: {response}")
            return False
        
        job = response["data"]
        if not job.get("job_number") or not job["job_number"].startswith("JOB-"):
            self.log_result("Test 2 - Create Production Job", False, f"Invalid job number format: {job.get('job_number')}")
            return False
        
        if job.get("status") != "In Progress":
            self.log_result("Test 2 - Create Production Job", False, f"Expected status 'In Progress', got: {job.get('status')}")
            return False
        
        if not job.get("items") or len(job["items"]) == 0:
            self.log_result("Test 2 - Create Production Job", False, "No items array in response")
            return False
        
        self.production_job_id = job["id"]
        self.job_item_id = job["items"][0]["id"]
        
        self.log_result("Test 2 - Create Production Job", True, f"Created job {job['job_number']} with {len(job['items'])} items")
        return True

    async def test_3_production_job_items(self) -> bool:
        """Test 3: Production Job Items - GET /api/production-job-items"""
        print("\n📦 Test 3: Production Job Items...")
        
        if not self.production_job_id:
            self.log_result("Test 3 - Production Job Items", False, "No production job ID available")
            return False
        
        success, response = await self.make_request("GET", f"production-job-items?job_id={self.production_job_id}")
        if not success:
            self.log_result("Test 3 - Production Job Items", False, f"Failed: {response}")
            return False
        
        items = response["data"]
        if not isinstance(items, list) or len(items) == 0:
            self.log_result("Test 3 - Production Job Items", False, f"Expected array with items, got: {items}")
            return False
        
        # Check structure of first item
        item = items[0]
        expected_fields = ["sku", "product_name", "size", "color", "ordered_qty", "shipment_qty", "produced_qty"]
        missing_fields = [field for field in expected_fields if field not in item]
        
        if missing_fields:
            self.log_result("Test 3 - Production Job Items", False, f"Missing fields: {missing_fields}")
            return False
        
        if item["produced_qty"] != 0:
            self.log_result("Test 3 - Production Job Items", False, f"Expected produced_qty=0, got: {item['produced_qty']}")
            return False
        
        self.log_result("Test 3 - Production Job Items", True, f"Retrieved {len(items)} items with correct structure")
        return True

    async def test_4_production_progress_per_job_item(self) -> bool:
        """Test 4: Production Progress (per job_item)"""
        print("\n📊 Test 4: Production Progress (per job_item)...")
        
        if not self.job_item_id:
            self.log_result("Test 4 - Production Progress", False, "No job item ID available")
            return False
        
        progress_data = {
            "job_item_id": self.job_item_id,
            "completed_quantity": 10,
            "progress_date": "2025-06-01",
            "notes": "First production progress test"
        }
        
        success, response = await self.make_request("POST", "production-progress", progress_data)
        if not success:
            self.log_result("Test 4 - Production Progress", False, f"Failed: {response}")
            return False
        
        progress = response["data"]
        if progress.get("completed_quantity") != 10:
            self.log_result("Test 4 - Production Progress", False, f"Expected completed_quantity=10, got: {progress.get('completed_quantity')}")
            return False
        
        if progress.get("new_total") != 10:
            self.log_result("Test 4 - Production Progress", False, f"Expected new_total=10, got: {progress.get('new_total')}")
            return False
        
        self.log_result("Test 4 - Production Progress", True, f"Progress recorded, job_item produced_qty incremented to {progress['new_total']}")
        return True

    async def test_5_production_progress_validation(self) -> bool:
        """Test 5: Production Progress Validation (exceed shipment_qty)"""
        print("\n🚫 Test 5: Production Progress Validation...")
        
        if not self.job_item_id:
            self.log_result("Test 5 - Progress Validation", False, "No job item ID available")
            return False
        
        # Try to add way more than shipment_qty
        invalid_progress_data = {
            "job_item_id": self.job_item_id,
            "completed_quantity": 9999,
            "progress_date": "2025-06-02"
        }
        
        success, response = await self.make_request("POST", "production-progress", invalid_progress_data)
        if success:
            self.log_result("Test 5 - Progress Validation", False, f"Should have failed but succeeded: {response}")
            return False
        
        if response.get("status") != 400:
            self.log_result("Test 5 - Progress Validation", False, f"Expected 400 status, got: {response.get('status')}")
            return False
        
        error_msg = response["data"].get("error", "")
        if "melebihi jumlah yang dikirim" not in error_msg:
            self.log_result("Test 5 - Progress Validation", False, f"Expected 'melebihi jumlah yang dikirim' error, got: {error_msg}")
            return False
        
        self.log_result("Test 5 - Progress Validation", True, f"Correctly rejected excess quantity: {error_msg}")
        return True

    async def test_6_po_status_auto_update(self) -> bool:
        """Test 6: PO Status Auto-update to 'In Production'"""
        print("\n🔄 Test 6: PO Status Auto-update...")
        
        if not self.po_id:
            self.log_result("Test 6 - PO Status Update", False, "No PO ID available")
            return False
        
        success, response = await self.make_request("GET", f"production-pos/{self.po_id}")
        if not success:
            self.log_result("Test 6 - PO Status Update", False, f"Failed to get PO: {response}")
            return False
        
        po = response["data"]
        if po.get("status") != "In Production":
            self.log_result("Test 6 - PO Status Update", False, f"Expected status 'In Production', got: {po.get('status')}")
            return False
        
        self.log_result("Test 6 - PO Status Update", True, f"PO status correctly updated to 'In Production'")
        return True

    async def test_7_buyer_shipment_from_job(self) -> bool:
        """Test 7: Buyer Shipment from Job"""
        print("\n🚢 Test 7: Buyer Shipment from Job...")
        
        if not all([self.production_job_id, self.po_id, self.job_item_id]):
            self.log_result("Test 7 - Buyer Shipment", False, "Missing required IDs")
            return False
        
        timestamp = datetime.now().strftime('%H%M%S')
        shipment_data = {
            "shipment_number": f"BS-FLOW-{timestamp}",
            "job_id": self.production_job_id,
            "po_id": self.po_id,
            "items": [{
                "job_item_id": self.job_item_id,
                "product_name": "Production Flow Product",
                "qty_shipped": 5,
                "ordered_qty": 100
            }]
        }
        
        success, response = await self.make_request("POST", "buyer-shipments", shipment_data)
        if not success:
            self.log_result("Test 7 - Buyer Shipment", False, f"Failed: {response}")
            return False
        
        shipment = response["data"]
        expected_status = "Partially Shipped" if shipment.get("ship_status") else "Pending"
        
        # Check ship_status calculation
        if "ship_status" in shipment:
            if shipment["ship_status"] == "Partially Shipped":
                self.log_result("Test 7 - Buyer Shipment", True, f"Created buyer shipment with status: {shipment['ship_status']}")
                return True
            else:
                self.log_result("Test 7 - Buyer Shipment", False, f"Expected 'Partially Shipped', got: {shipment['ship_status']}")
                return False
        else:
            self.log_result("Test 7 - Buyer Shipment", True, f"Buyer shipment created successfully")
            return True

    async def test_8_buyer_shipment_validation(self) -> bool:
        """Test 8: Buyer Shipment Validation (exceed produced_qty)"""
        print("\n🚫 Test 8: Buyer Shipment Validation...")
        
        if not self.job_item_id:
            self.log_result("Test 8 - Buyer Shipment Validation", False, "No job item ID available")
            return False
        
        timestamp = datetime.now().strftime('%H%M%S')
        invalid_shipment_data = {
            "shipment_number": f"BS-INVALID-{timestamp}",
            "job_id": self.production_job_id,
            "po_id": self.po_id,
            "items": [{
                "job_item_id": self.job_item_id,
                "product_name": "Test Product",
                "qty_shipped": 999,  # Way more than produced_qty (10)
                "ordered_qty": 100
            }]
        }
        
        success, response = await self.make_request("POST", "buyer-shipments", invalid_shipment_data)
        if success:
            self.log_result("Test 8 - Buyer Shipment Validation", False, f"Should have failed but succeeded: {response}")
            return False
        
        if response.get("status") != 400:
            self.log_result("Test 8 - Buyer Shipment Validation", False, f"Expected 400 status, got: {response.get('status')}")
            return False
        
        error_msg = response["data"].get("error", "")
        if "melebihi qty yang sudah diproduksi" not in error_msg:
            self.log_result("Test 8 - Buyer Shipment Validation", False, f"Expected production quantity error, got: {error_msg}")
            return False
        
        self.log_result("Test 8 - Buyer Shipment Validation", True, f"Correctly rejected excess shipment: {error_msg}")
        return True

    async def test_9_duplicate_job_prevention(self) -> bool:
        """Test 9: Duplicate Job Prevention"""
        print("\n🚫 Test 9: Duplicate Job Prevention...")
        
        if not self.vendor_shipment_id:
            self.log_result("Test 9 - Duplicate Job Prevention", False, "No vendor shipment ID available")
            return False
        
        # Try to create another job for the same shipment
        duplicate_job_data = {
            "vendor_shipment_id": self.vendor_shipment_id,
            "vendor_id": self.vendor_id,
            "notes": "This should fail - duplicate job"
        }
        
        success, response = await self.make_request("POST", "production-jobs", duplicate_job_data)
        if success:
            self.log_result("Test 9 - Duplicate Job Prevention", False, f"Should have failed but succeeded: {response}")
            return False
        
        if response.get("status") != 400:
            self.log_result("Test 9 - Duplicate Job Prevention", False, f"Expected 400 status, got: {response.get('status')}")
            return False
        
        error_msg = response["data"].get("error", "")
        if "sudah ada" not in error_msg:
            self.log_result("Test 9 - Duplicate Job Prevention", False, f"Expected 'sudah ada' error, got: {error_msg}")
            return False
        
        self.log_result("Test 9 - Duplicate Job Prevention", True, f"Correctly prevented duplicate job: {error_msg}")
        return True

    async def test_10_get_production_jobs(self) -> bool:
        """Test 10: GET Production Jobs with metrics"""
        print("\n📋 Test 10: GET Production Jobs...")
        
        success, response = await self.make_request("GET", "production-jobs")
        if not success:
            self.log_result("Test 10 - GET Production Jobs", False, f"Failed: {response}")
            return False
        
        jobs = response["data"]
        if not isinstance(jobs, list):
            self.log_result("Test 10 - GET Production Jobs", False, f"Expected array, got: {type(jobs)}")
            return False
        
        if len(jobs) == 0:
            self.log_result("Test 10 - GET Production Jobs", True, "Empty jobs array returned")
            return True
        
        # Check structure of first job
        job = jobs[0]
        expected_fields = ["item_count", "total_ordered", "total_produced", "progress_pct"]
        missing_fields = [field for field in expected_fields if field not in job]
        
        if missing_fields:
            self.log_result("Test 10 - GET Production Jobs", False, f"Missing fields: {missing_fields}")
            return False
        
        self.log_result("Test 10 - GET Production Jobs", True, f"Retrieved {len(jobs)} jobs with correct metrics")
        return True

    async def run_all_tests(self):
        """Run all Production Flow Restructure tests"""
        print("🚀 Starting Production Flow Restructure Backend Tests\n")
        print("=" * 70)
        
        # Login first
        if not await self.login_superadmin():
            print("❌ Cannot continue without valid login")
            return False
        
        # Setup test data
        if not await self.setup_test_data():
            print("❌ Cannot continue without test data")
            return False
        
        # Run all tests
        test_functions = [
            self.test_1_distribusi_kerja_autopopulated,
            self.test_2_production_job_creation,
            self.test_3_production_job_items,
            self.test_4_production_progress_per_job_item,
            self.test_5_production_progress_validation,
            self.test_6_po_status_auto_update,
            self.test_7_buyer_shipment_from_job,
            self.test_8_buyer_shipment_validation,
            self.test_9_duplicate_job_prevention,
            self.test_10_get_production_jobs
        ]
        
        passed = 0
        total = len(test_functions)
        
        for test_func in test_functions:
            try:
                if await test_func():
                    passed += 1
            except Exception as e:
                self.log_result(test_func.__name__, False, f"Test threw exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 70)
        print(f"🏁 Test Summary: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
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
    async with ProductionFlowTester() as tester:
        success = await tester.run_all_tests()
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())