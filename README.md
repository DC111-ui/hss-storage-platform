# Hatfield Storage Solutions (HSS) – Storage Booking Platform

## Project Overview

Hatfield Storage Solutions (HSS) is a seasonal student storage service based in Hatfield, Pretoria. At the end of each academic year, students need short-term storage for room contents (beds, fridges, desks, boxes). This repository now targets a **custom web UI** instead of WordPress, with AWS infrastructure for hosting the app, storing booking data, and keeping inventory media.

## Product Direction (WordPress Removed)

The project is being migrated away from WordPress/WooCommerce toward a custom-built interface and API-driven workflow.

### Current custom UI prototype

A lightweight frontend prototype is available in `ui/` and includes:
- A storage price estimator (item quantities + duration)
- A booking request form UI
- Client-side estimate feedback to support backend API integration

Run it locally:

```bash
cd ui
python3 -m http.server 8080
# open http://localhost:8080
```

## Objectives

### Customer features
- Book storage pickups for seasonal periods
- Calculate pricing by item type and storage duration
- Track booking status and stored inventory (planned backend integration)

### Admin features
- Manage storage unit capacity and seasonal availability (planned)
- View booking requests and inventory details (planned)

### Infrastructure
- Provision infrastructure with AWS CloudFormation
- Use EC2 for the custom web app/API runtime
- Use RDS MySQL for booking and user data
- Use S3 for inventory photos/documents

## Architecture

High-level architecture remains cloud-friendly and demo-focused:

```text
User → Internet → EC2 (Custom UI + API) → RDS (MySQL)
                               ↓
                              S3 (Inventory Photos)
```

## Deliverables

1. CloudFormation template for AWS demo infrastructure
2. Custom UI starter in `ui/`
3. Documentation for migration from WordPress to custom app architecture

## Future Enhancements

- Build REST/GraphQL backend for booking persistence
- Add authentication and role-based admin dashboards
- Implement notifications (email/SMS)
- Harden production deployment (HTTPS, private networking, backups)
- Add CI/CD for automated deployments

## License

For educational and portfolio purposes only.
