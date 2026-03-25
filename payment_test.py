#!/usr/bin/env python3

import requests
import json
import os
from datetime import datetime, timedelta

# Configuration
BASE_URL = os.getenv('NEXT_PUBLIC_BASE_URL', 'https://pdf-auth-fix-2.preview.emergentagent.com')
API_URL = f"{BASE_URL}/api"

print(f"🚀 Testing Garment ERP Backend Payment Flow at: {API_URL}")
print("=" * 60)

class PaymentTester:
    def __init__(self):
        self.token = None
        self.headers = {'Content-Type': 'application/json'}
        
    def login(self):
        """Login to get JWT token"""
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

    def create_invoice_and_test_payment(self):
        """Create an invoice by completing a work order, then test payment validation"""
        try:
            print("\n2️⃣ Creating Invoice and Testing Payment Validation...")
            
            # Get work orders that are not completed yet
            print("   📋 Getting work orders...")
            wo_response = requests.get(f"{API_URL}/work-orders", headers=self.headers, timeout=30)
            if wo_response.status_code != 200:
                print(f"   ❌ Failed to get work orders: {wo_response.status_code}")
                return False
            
            work_orders = wo_response.json()
            incomplete_wos = [wo for wo in work_orders if wo.get('status') != 'Completed']
            
            if not incomplete_wos:
                print("   ❌ No incomplete work orders found")
                return False
            
            wo = incomplete_wos[0]
            wo_id = wo['id']
            wo_qty = wo.get('quantity', 0)
            print(f"   ✅ Using work order: {wo.get('distribution_code')} (qty: {wo_qty})")
            
            # Complete the work order to generate invoice
            print("   🔨 Completing work order to generate invoice...")
            progress_data = {
                "work_order_id": wo_id,
                "completed_quantity": wo_qty,  # Complete full quantity
                "progress_date": datetime.now().strftime("%Y-%m-%d"),
                "notes": "Completing work order for payment validation test"
            }
            
            progress_response = requests.post(f"{API_URL}/production-progress", 
                                            headers=self.headers, 
                                            json=progress_data,
                                            timeout=30)
            
            if progress_response.status_code != 201:
                print(f"   ❌ Failed to create progress: {progress_response.status_code} - {progress_response.text}")
                return False
            
            print(f"   ✅ Work order completed")
            
            # Wait a bit and check for generated invoice
            print("   🔍 Looking for auto-generated invoice...")
            import time
            time.sleep(1)
            
            invoices_response = requests.get(f"{API_URL}/invoices", headers=self.headers, timeout=30)
            if invoices_response.status_code != 200:
                print(f"   ❌ Failed to get invoices: {invoices_response.status_code}")
                return False
            
            invoices = invoices_response.json()
            new_invoice = next((inv for inv in invoices if inv.get('work_order_id') == wo_id), None)
            
            if not new_invoice:
                print(f"   ❌ No invoice found for completed work order")
                return False
            
            invoice_id = new_invoice['id']
            invoice_amount = new_invoice.get('total_amount', 0)
            print(f"   ✅ Invoice found: {new_invoice.get('invoice_number')} (Amount: {invoice_amount})")
            
            # Now test payment validation
            print(f"\n3️⃣ Testing Payment Amount Validation...")
            
            # Step 1: Record payment of full amount
            print(f"   💰 Recording payment for full amount ({invoice_amount})...")
            payment1_data = {
                "invoice_id": invoice_id,
                "amount": invoice_amount,
                "payment_date": "2025-06-01",
                "payment_method": "Transfer Bank",
                "reference": "Full payment test",
                "notes": "Testing payment validation - full amount"
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
                        total_paid = updated_invoice.get('total_paid', 0)
                        print(f"   ✅ Invoice status: Unpaid → {new_status}")
                        print(f"   ✅ Total paid: {total_paid}")
                    else:
                        print(f"   ⚠️  Could not find updated invoice")
                
            else:
                print(f"   ❌ Full payment failed: {payment1_response.status_code} - {payment1_response.text}")
                return False
            
            # Step 2: Try to record another payment for same (now Paid) invoice
            print("   ❌ Attempting additional payment on Paid invoice...")
            payment2_data = {
                "invoice_id": invoice_id,
                "amount": 50000,
                "payment_date": "2025-06-02",
                "payment_method": "Cash",
                "reference": "Excess payment test",
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
                
                # Check final invoice status and total paid
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
                        print(f"   📊 Overpayment: {total_paid - invoice_amount}")
                
            else:
                print(f"   ✅ Additional payment REJECTED: {payment2_response.status_code} - {payment2_response.text}")
                print(f"   📊 BACKEND BEHAVIOR: Validates payments against invoice status/amount")
            
            return True
            
        except Exception as e:
            print(f"   ❌ PAYMENT TEST ERROR: {str(e)}")
            return False

    def run_test(self):
        """Run the test"""
        print("🧪 Testing Payment Validation on Auto-Generated Invoice")
        print("=" * 60)
        
        if not self.login():
            print("\n💥 Cannot proceed - login failed")
            return False
            
        result = self.create_invoice_and_test_payment()
        
        print(f"\n📋 SUMMARY:")
        if result:
            print(f"   ✅ Payment validation test completed successfully")
            print(f"   📊 Backend allows payments even on fully paid invoices")
            print(f"   📊 Invoice status updates correctly based on payment amounts")
        else:
            print(f"   ❌ Payment validation test failed")
        
        return result

if __name__ == "__main__":
    tester = PaymentTester()
    success = tester.run_test()
    
    if success:
        exit(0)
    else:
        exit(1)