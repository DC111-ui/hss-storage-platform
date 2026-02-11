# Hatfield Storage Solutions (HSS) – Storage Booking Platform

## **Project Overview**

Hatfield Storage Solutions (HSS) is a seasonal student storage service based in Hatfield Pretoria. This is a student area where thousands of university students reside. At the end of the academic year, a lot of student accomodations require students to move all their belongins from their appartments/rooms. They often need convinient, secure storage for items such as beds, fridges, desks, and boxes. HSS provides pickup, secure storage in third-party units, and return of items. Pricing is calculated based on item type, quantity, and storage duration.

This project demonstrates a cloud-based, WordPress-powered web platform that enables students to request storage, manage bookings, and track their items. Administrators can manage storage units, bookings, and inventory efficiently. The project is built as a **demo and portfolio piece**, using **AWS Free Tier services**.

---

## **Objectives**

* **Customer Features**

  * Book storage for items
  * Calculate pricing based on item type and storage duration
  * View booking status and stored items
  * QR codes for booking confirmation
* **Admin Features**

  * Manage storage units and seasonal availability
  * Track bookings and inventory
  * View QR codes linked to stored items
* **Infrastructure & Deployment**

  * Provisioned using **AWS CloudFormation** (EC2, RDS, S3, IAM)
  * Demonstrates Infrastructure as Code principles
  * Fully deployable on AWS Free Tier for demo purposes
* **Documentation & Reporting**

  * Architecture diagrams
  * Demo screenshots
  * Project scope and workflow documentation

---

## **Project Scope**

**In-Scope**

* WordPress-based web platform with WooCommerce for booking simulation
* Dynamic pricing calculations per item and duration
* Customer login and booking dashboard
* Admin management interface for storage units
* QR code generation for bookings (demo)
* Deployment using AWS CloudFormation

**Out of Scope**

* Production-level security (HTTPS, private subnets)
* Real payment processing (uses WooCommerce sandbox mode)
* Auto-scaling or high-availability architecture
* Integration with third-party logistics APIs

**Assumptions**

* Storage units are rented from third-party providers
* Maximum of **5 storage units per season**
* Project is for demonstration and portfolio purposes only

---

## **Architecture**

The platform architecture is simple, cloud-friendly, and **demo-focused**:

**Components:**

* **EC2 t3.micro** – Hosts WordPress and WooCommerce
* **Amazon RDS MySQL** – Stores booking and user data
* **Amazon S3** – Stores inventory photos and documents
* **IAM Roles** – Grants EC2 secure access to S3
* **CloudFormation** – Infrastructure as Code for reproducible deployment

**High-Level Flow:**

```
User → Internet → EC2 (WordPress) → RDS (MySQL)
                          ↓
                         S3 (Inventory Photos)
```

* Customers access the site via browser
* EC2 handles application logic
* RDS stores structured data
* S3 stores inventory media, accessed securely via IAM role

---

## **Deliverables**

1. **CloudFormation Template** – Deploys infrastructure on AWS Free Tier
2. **WordPress Demo Site** – Customer and admin portals
3. **Custom Plugin Skeleton** – Handles bookings, storage units, and QR codes
4. **Architecture Diagram** – Visual representation of the system
5. **Documentation & Screenshots** – Scope, workflow, and portfolio evidence

---



## **AWS Best Practices Applied in This Repository**

The CloudFormation stack now includes foundational AWS best-practice controls while still staying demo-friendly:

* **Least privilege IAM**: EC2 gets scoped S3 permissions (not account-wide S3 full access)
* **S3 hardening**: block public access, enable default encryption (SSE-S3), and enable versioning
* **Network segmentation**: dedicated security groups for web and database tiers
* **Restricted DB exposure**: RDS is non-public and only reachable from the EC2 security group
* **Platform hardening**: EC2 enforces IMDSv2 tokens
* **Data protection and recovery**: RDS encryption at rest, 7-day backups, and snapshot on stack deletion
* **Safer operations**: SSH ingress is parameterized with `AllowedSSHCidr` to avoid always-open admin access

These controls are intentionally lightweight so the project remains practical for learning and portfolio demonstrations.

---

## **Future Enhancements**

* Production-ready deployment with HTTPS, private subnets, and scaling
* Real payment gateway integration
* SMS or email notifications for bookings
* Capacity-based storage optimization
* Multi-environment CloudFormation stacks

---

## **Author Notes**

This project was designed as a **demonstration and portfolio project**. It highlights:

* Cloud architecture knowledge (AWS services + IaC)
* WordPress application customization
* Business logic implementation for a real-world problem
* Documentation and portfolio readiness

---

## **License**

For educational and portfolio purposes only.


