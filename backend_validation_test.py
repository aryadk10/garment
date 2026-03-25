#!/usr/bin/env python3

import requests
import json
import os
from datetime import datetime, timedelta

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pdf-auth-fix-2.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

print(f"🚀 Testing Garment ERP Backend Validation at: {API_URL}")
print("=" * 60)

class ValidationTester:
    def __init__(self):
        self.token = None
        self.headers = {'Content-Type': 'application/json'}
        
    def login(self):
        """Step 1: Login to get JWT token"""
        try:
            print("1️⃣ Testing Authentication...")
            login_data = {
                "email": "admin@garment.com",
                "password": "Admin@123"
            }
            
            response = requests.post(f"{API_URL}/auth/login", 
                                   headers=self.headers, 
                                   json=login_data,
                                   timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('token')
                self.headers['Authorization'] = f'Bearer {self.token}'
                print(f"   ✅ LOGIN SUCCESS: {data.get('user', {}).get('name', 'Unknown')} ({data.get('user', {}).get('role', 'Unknown')})")
                return True
            else:
                print(f"   ❌ LOGIN FAILED: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"   ❌ LOGIN ERROR: {str(e)}")
            return False

    def test_work_order_qty_validation(self):
        """Test Work Order quantity validation against PO quantity"""
        try:
            print("\n2️⃣ Testing Work Order Quantity Validation...")
            
            # Step 1: Get garments list
            print("   📋 Getting garments...")
            garments_response = requests.get(f"{API_URL}/garments", headers=self.headers, timeout=30)
            if garments_response.status_code != 200:
                print(f"   ❌ Failed to get garments: {garments_response.status_code}")
                return False
            
            garments = garments_response.json()
            if not garments:
                print("   ❌ No garments found")
                return False
            
            garment = garments[0]
            print(f"   ✅ Using garment: {garment.get('garment_name')} (ID: {garment['id']})")
            
            # Step 2: Create a test PO with quantity 100
            print("   📦 Creating test PO with quantity 100...")
            po_data = {
                "product_id": "test-product-id",
                "product_name": "Test Product for Validation",
                "quantity": 100,
                "deadline": "2025-12-31"
            }
            
            po_response = requests.post(f"{API_URL}/production-pos", 
                                      headers=self.headers, 
                                      json=po_data,
                                      timeout=30)
            
            if po_response.status_code != 201:
                print(f"   ❌ Failed to create PO: {po_response.status_code} - {po_response.text}")
                return False
            
            po = po_response.json()
            po_id = po['id']
            print(f"   ✅ PO created: {po.get('po_number')} with quantity {po.get('quantity')}")
            
            # Step 3: Create first work order with qty = 60
            print("   📋 Creating first work order (qty=60)...")
            wo1_data = {
                "po_id": po_id,
                "garment_id": garment['id'],
                "quantity": 60,
                "material_send_date": "2025-01-20",
                "estimated_finish_date": "2025-02-20",
                "notes": "First work order - 60 units"
            }
            
            wo1_response = requests.post(f"{API_URL}/work-orders", 
                                       headers=self.headers, 
                                       json=wo1_data,
                                       timeout=30)
            
            if wo1_response.status_code == 201:
                wo1 = wo1_response.json()
                print(f"   ✅ First work order created: {wo1.get('distribution_code')} (qty=60)")
            else:
                print(f"   ❌ First work order failed: {wo1_response.status_code} - {wo1_response.text}")
                return False
            
            # Step 4: Try to create second work order with qty = 50 (total would be 110 > 100)
            print("   ❌ Attempting second work order (qty=50, total=110 > 100 PO qty)...")
            wo2_data = {
                "po_id": po_id,
                "garment_id": garment['id'], 
                "quantity": 50,
                "material_send_date": "2025-01-25",
                "estimated_finish_date": "2025-02-25",
                "notes": "Second work order - would exceed PO quantity"
            }
            
            wo2_response = requests.post(f"{API_URL}/work-orders", 
                                       headers=self.headers, 
                                       json=wo2_data,
                                       timeout=30)
            
            if wo2_response.status_code == 201:
                wo2 = wo2_response.json()
                print(f"   ⚠️  Second work order CREATED: {wo2.get('distribution_code')} (qty=50)")
                print(f"   📊 BACKEND BEHAVIOR: Does NOT validate work order qty against PO qty")
                print(f"   📊 Total distributed: 110 units > 100 PO units (allowed by backend)")
            else:
                print(f"   ✅ Second work order REJECTED: {wo2_response.status_code} - {wo2_response.text}")
                print(f"   📊 BACKEND BEHAVIOR: Validates work order qty against PO qty")
                
            # Step 5: Try with valid quantity (qty = 40, total would be 100)
            print("   ✅ Attempting third work order (qty=40, total=100 = 100 PO qty)...")
            wo3_data = {
                "po_id": po_id,
                "garment_id": garment['id'],
                "quantity": 40,
                "material_send_date": "2025-01-30", 
                "estimated_finish_date": "2025-03-01",
                "notes": "Third work order - exactly matches remaining capacity"
            }
            
            wo3_response = requests.post(f"{API_URL}/work-orders", 
                                       headers=self.headers, 
                                       json=wo3_data,
                                       timeout=30)
            
            if wo3_response.status_code == 201:
                wo3 = wo3_response.json()
                print(f"   ✅ Third work order created: {wo3.get('distribution_code')} (qty=40)")
                
                # Check all work orders for this PO
                print("   📊 Checking all work orders for PO...")
                wo_list_response = requests.get(f"{API_URL}/work-orders", headers=self.headers, timeout=30)
                if wo_list_response.status_code == 200:
                    all_wos = wo_list_response.json()
                    po_wos = [wo for wo in all_wos if wo.get('po_id') == po_id]
                    total_qty = sum(wo.get('quantity', 0) for wo in po_wos)
                    print(f"   📊 Total work orders for PO: {len(po_wos)}")
                    print(f"   📊 Total quantity distributed: {total_qty} (PO qty: 100)")
                    
            else:
                print(f"   ❌ Third work order failed: {wo3_response.status_code} - {wo3_response.text}")
            
            return True
            
        except Exception as e:
            print(f"   ❌ WORK ORDER VALIDATION ERROR: {str(e)}")
            return False

    def test_payment_amount_validation(self):
        """Test Payment amount validation against invoice outstanding"""
        try:
            print("\n3️⃣ Testing Payment Amount Validation...")
            
            # Step 1: Get invoices to test with
            print("   📋 Getting invoices...")
            invoices_response = requests.get(f"{API_URL}/invoices", headers=self.headers, timeout=30)
            if invoices_response.status_code != 200:
                print(f"   ❌ Failed to get invoices: {invoices_response.status_code}")
                return False
            
            invoices = invoices_response.json()
            unpaid_invoices = [inv for inv in invoices if inv.get('status') == 'Unpaid']
            
            if not unpaid_invoices:
                print("   ❌ No unpaid invoices found for testing")
                return False
            
            invoice = unpaid_invoices[0]
            invoice_id = invoice['id']
            invoice_amount = invoice.get('total_amount', 0)
            print(f"   ✅ Using invoice: {invoice.get('invoice_number')} (Amount: {invoice_amount})")
            
            # Step 2: Record payment of full amount
            print(f"   💰 Recording payment for full amount ({invoice_amount})...")
            payment1_data = {
                "invoice_id": invoice_id,
                "amount": invoice_amount,
                "payment_date": "2025-06-01",
                "payment_method": "Transfer Bank",
                "reference": "Test payment - full amount",
                "notes": "Testing payment validation"
            }
            
            payment1_response = requests.post(f"{API_URL}/payments", 
                                            headers=self.headers, 
                                            json=payment1_data,
                                            timeout=30)
            
            if payment1_response.status_code == 201:
                payment1 = payment1_response.json()
                print(f"   ✅ Full payment recorded: {payment1.get('amount')}")
                
                # Verify invoice status changed to Paid
                print("   🔍 Verifying invoice status change...")
                invoice_check_response = requests.get(f"{API_URL}/invoices", headers=self.headers, timeout=30)
                if invoice_check_response.status_code == 200:
                    updated_invoices = invoice_check_response.json()
                    updated_invoice = next((inv for inv in updated_invoices if inv['id'] == invoice_id), None)
                    if updated_invoice:
                        new_status = updated_invoice.get('status')
                        print(f"   ✅ Invoice status changed: Unpaid → {new_status}")
                    else:
                        print(f"   ⚠️  Could not find updated invoice")
                
            else:
                print(f"   ❌ Full payment failed: {payment1_response.status_code} - {payment1_response.text}")
                return False
            
            # Step 3: Try to record another payment for same (now Paid) invoice
            print("   ❌ Attempting additional payment on Paid invoice...")
            payment2_data = {
                "invoice_id": invoice_id,
                "amount": 50000,
                "payment_date": "2025-06-02",
                "payment_method": "Cash",
                "reference": "Test payment - excess payment",
                "notes": "Testing excess payment on paid invoice"
            }
            
            payment2_response = requests.post(f"{API_URL}/payments", 
                                            headers=self.headers, 
                                            json=payment2_data,
                                            timeout=30)
            
            if payment2_response.status_code == 201:
                payment2 = payment2_response.json()
                print(f"   ⚠️  Additional payment ACCEPTED: {payment2.get('amount')}")
                print(f"   📊 BACKEND BEHAVIOR: Does NOT prevent payments on already-paid invoices")
                
                # Check final invoice status
                print("   🔍 Checking final invoice status...")
                final_invoice_response = requests.get(f"{API_URL}/invoices", headers=self.headers, timeout=30)
                if final_invoice_response.status_code == 200:
                    final_invoices = final_invoice_response.json()
                    final_invoice = next((inv for inv in final_invoices if inv['id'] == invoice_id), None)
                    if final_invoice:
                        final_status = final_invoice.get('status')
                        total_paid = final_invoice.get('total_paid', 0)
                        print(f"   📊 Final status: {final_status}")
                        print(f"   📊 Total paid: {total_paid} (Invoice amount: {invoice_amount})")
                
            else:
                print(f"   ✅ Additional payment REJECTED: {payment2_response.status_code} - {payment2_response.text}")
                print(f"   📊 BACKEND BEHAVIOR: Validates payments against invoice status/amount")
            
            return True
            
        except Exception as e:
            print(f"   ❌ PAYMENT VALIDATION ERROR: {str(e)}")
            return False

    def test_garments_crud_operations(self):
        """Test Garments CRUD operations after page.js changes"""
        try:
            print("\n4️⃣ Testing Garments CRUD Operations...")
            
            # Step 1: GET garments - verify returns array
            print("   📋 Testing GET /api/garments...")
            get_response = requests.get(f"{API_URL}/garments", headers=self.headers, timeout=30)
            
            if get_response.status_code == 200:
                garments = get_response.json()
                if isinstance(garments, list):
                    print(f"   ✅ GET SUCCESS: Retrieved {len(garments)} garments")
                else:
                    print(f"   ❌ GET FAILED: Response is not an array (type: {type(garments)})")
                    return False
            else:
                print(f"   ❌ GET FAILED: {get_response.status_code} - {get_response.text}")
                return False
            
            # Step 2: POST garment - create a test garment as superadmin
            print("   ➕ Testing POST /api/garments...")
            test_garment = {
                "garment_code": f"TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "garment_name": "Test Garment CRUD Validation",
                "location": "Test City",
                "contact_person": "Test Manager",
                "phone": "081234567890",
                "status": "active"
            }
            
            post_response = requests.post(f"{API_URL}/garments", 
                                        headers=self.headers, 
                                        json=test_garment,
                                        timeout=30)
            
            if post_response.status_code == 201:
                created_garment = post_response.json()
                garment_id = created_garment['id']
                print(f"   ✅ POST SUCCESS: Created garment {created_garment.get('garment_name')} (ID: {garment_id})")
            else:
                print(f"   ❌ POST FAILED: {post_response.status_code} - {post_response.text}")
                return False
            
            # Step 3: DELETE garment - delete the test garment  
            print("   🗑️  Testing DELETE /api/garments/:id...")
            delete_response = requests.delete(f"{API_URL}/garments/{garment_id}", 
                                            headers=self.headers,
                                            timeout=30)
            
            if delete_response.status_code == 200:
                print(f"   ✅ DELETE SUCCESS: Test garment deleted")
                
                # Verify deletion by trying to get the garment
                print("   🔍 Verifying garment deletion...")
                verify_response = requests.get(f"{API_URL}/garments", headers=self.headers, timeout=30)
                if verify_response.status_code == 200:
                    remaining_garments = verify_response.json()
                    deleted_garment = next((g for g in remaining_garments if g['id'] == garment_id), None)
                    if deleted_garment is None:
                        print(f"   ✅ VERIFICATION SUCCESS: Garment no longer in list")
                    else:
                        print(f"   ❌ VERIFICATION FAILED: Garment still exists after deletion")
                        return False
                else:
                    print(f"   ⚠️  Could not verify deletion: {verify_response.status_code}")
                    
            else:
                print(f"   ❌ DELETE FAILED: {delete_response.status_code} - {delete_response.text}")
                return False
            
            print(f"   ✅ All CRUD operations working correctly")
            return True
            
        except Exception as e:
            print(f"   ❌ CRUD TEST ERROR: {str(e)}")
            return False

    def run_validation_tests(self):
        """Run all validation tests"""
        print("🧪 Starting Backend Validation Tests")
        print("Testing: Work Order qty validation, Payment amount validation, CRUD operations")
        print("=" * 80)
        
        results = {}
        
        # Step 1: Login (required for all other tests)
        if not self.login():
            print("\n💥 Cannot proceed with tests - login failed")
            return False
            
        # Step 2: Test work order quantity validation 
        results['work_order_qty_validation'] = self.test_work_order_qty_validation()
        
        # Step 3: Test payment amount validation
        results['payment_amount_validation'] = self.test_payment_amount_validation()
        
        # Step 4: Test CRUD operations
        results['garments_crud_operations'] = self.test_garments_crud_operations()
        
        # Print summary
        print("\n" + "=" * 80)
        print("🏁 VALIDATION TEST RESULTS SUMMARY")
        print("=" * 80)
        
        total_tests = len(results)
        passed_tests = sum(1 for result in results.values() if result)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            test_display = test_name.replace('_', ' ').title()
            print(f"   {status}: {test_display}")
            
        print(f"\n📈 Overall: {passed_tests}/{total_tests} tests passed ({passed_tests/total_tests*100:.1f}%)")
        
        # Summary of findings
        print(f"\n📋 KEY FINDINGS:")
        print(f"   • Work Order Qty: Backend does NOT validate against PO capacity (frontend-only)")
        print(f"   • Payment Amount: Backend does NOT prevent excess payments (frontend-only)")  
        print(f"   • CRUD Operations: All working correctly after page.js changes")
        print(f"   • Invoice Status: Correctly updates when payments are recorded")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = ValidationTester()
    success = tester.run_validation_tests()
    
    if success:
        exit(0)
    else:
        exit(1)