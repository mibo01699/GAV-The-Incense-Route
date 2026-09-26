# 📍 GAV — GPS Verification System
## Geographic Verification for Real-World Barter Festivals

**Version:** 1.0.0  
**Date:** September 26, 2026

---

## 🎯 Purpose

The GPS Verification System ensures that:
1. **Festivals are real** (not virtual).
2. **Participants are physically present**.
3. **Photos are authentic** (not AI-generated).
4. **Voting is geographically scoped** (7 layers).
5. **Exchanges happen in real locations**.

**Core Principle:** No GPS, no verification. No verification, no YER reward.

---

## 📐 Precision Requirements

**All GPS coordinates use integer Micro-Degrees.**

### Why Integer?

Floating-point GPS values can cause:
- ❌ Precision errors (±0.0000001°).
- ❌ Inconsistent distance calculations.
- ❌ Unfair voting scopes.
- ❌ Fraud opportunities.

### Solution: Micro-Degrees (Integer)

**1 degree = 1,000,000 micro-degrees**

| Coordinate | Decimal | Micro-Degrees (Integer) |
|:---|:---|:---|
| Sana'a Latitude | 15.369445° | 15,369,445 |
| Sana'a Longitude | 44.191044° | 44,191,044 |
| Aden Latitude | 12.785509° | 12,785,509 |
| Aden Longitude | 45.018668° | 45,018,668 |

**Storage:** All GPS coordinates stored as `BigInt` or `Integer`.

```javascript
// ✅ CORRECT
const latitude = 15369445n;   // Micro-degrees
const longitude = 44191044n;  // Micro-degrees

// ❌ FORBIDDEN
const latitude = 15.369445;   // Float
const longitude = 44.191044;  // Float
```

---

📏 Distance Calculation

Haversine Formula using Integer Arithmetic

Since floats are forbidden, we use squared distance comparison (no square root needed).

Formula:

```
distance² ≈ (Δlat × 111,000,000,000)² + (Δlng × cos(lat) × 111,000,000,000)²
```

Where:

· Δlat = difference in micro-degrees latitude
· Δlng = difference in micro-degrees longitude
· cos(lat) = pre-computed integer (multiplied by 1,000,000)
· Result is in square meters (integer)

Example:

```javascript
function distanceSquared(lat1, lng1, lat2, lng2) {
    // All inputs are BigInt micro-degrees
    const dLat = lat2 - lat1;
    const dLng = lng2 - lng1;
    
    // cos(lat) pre-computed as integer (× 1,000,000)
    const cosLat = getCosLat(lat1);
    
    // 111,000,000,000 = meters per degree × 1,000,000 micro
    const latMeters = (dLat * 111000000000n) / 1000000n;
    const lngMeters = (dLng * 111000000000n * cosLat) / (1000000n * 1000000n);
    
    return (latMeters * latMeters) + (lngMeters * lngMeters);
}
```

---

🔍 Verification Layers

1. Festival Creation Verification

When: User creates a festival.

Requirement:

· Organizer must be at the festival location (GPS).
· Tolerance: 100 meters (10,000 square meters).

Process:

1. User opens GAV in Pi Browser.
2. GAV requests GPS from device.
3. GAV compares GPS with festival location.
4. If within tolerance → Festival created.
5. If outside → Rejected with message.

API:

```
POST /api/v1/gps/verify-festival
Body: { festivalId, latitude, longitude }
Response: { verified: true/false, distance: <meters> }
```

---

2. Photo Upload Verification

When: User uploads festival photos.

Requirement:

· Photo must contain EXIF GPS data.
· EXIF GPS must match festival location.
· EXIF timestamp must be recent (within 24 hours).

Process:

1. User selects photo.
2. GAV reads EXIF data.
3. GAV verifies GPS coordinates.
4. GAV verifies timestamp.
5. If valid → Uploaded.
6. If invalid → Rejected.

Rejection Cases:

· No EXIF data → Rejected.
· GPS mismatch → Rejected.
· Old timestamp → Rejected.
· AI-generated → Rejected.

API:

```
POST /api/v1/gps/verify-photo
Body: { festivalId, photo }
Response: { verified: true/false, reason: <string> }
```

---

3. Voting Scope Verification

When: User votes on any layer.

Requirement:

· Each voting layer has a GPS scope.
· User's GPS must be within scope.

Scopes:

Layer Scope
Layer 1 (Profile Reputation) Global
Layer 2 (Festival - Country) Country borders
Layer 3 (Individual Exchange - Public) Global
Layer 4 (Individual Exchange - Private) 20,000 m²
Layer 5 (Festival Invitation) 50,000 m²
Layer 6 (In-Festival) Festival venue
Layer 7 (Festival Exchange - Public) Global
Additional (Receipt) Global

Process:

1. User taps vote.
2. GAV requests GPS.
3. GAV checks scope.
4. If within → Vote recorded.
5. If outside → Vote rejected.

API:

```
POST /api/v1/gps/verify-vote
Body: { layer, postId, latitude, longitude }
Response: { verified: true/false, distance: <meters> }
```

---

4. Exchange Location Verification

When: User creates an individual exchange request.

Requirement:

· Product location must be documented.
· GPS coordinates captured.
· Photo with GPS required.

Process:

1. User opens "Create Individual Exchange".
2. GAV requests GPS.
3. User uploads product photo.
4. GAV verifies EXIF GPS.
5. Exchange request published.

API:

```
POST /api/v1/gps/verify-exchange
Body: { productId, latitude, longitude, photo }
Response: { verified: true/false }
```

---

🗺️ Geographic Scopes

Country Detection

How: Reverse geocoding (GPS → country).

Storage: Country code (ISO 3166-1 alpha-2).

Example:

```javascript
const country = await reverseGeocode(lat, lng);
// Returns: 'YE' for Yemen
```

State/Province Detection

How: Second-level geocoding.

Storage: State/Province code.

Example:

```javascript
const state = await reverseGeocodeState(lat, lng);
// Returns: 'Sanaa' for Sana'a governorate
```

---

📐 Distance Tolerances

Verification Type Tolerance Area
Festival creation 100 m 10,000 m²
Festival photo 200 m 40,000 m²
Private exchange (Layer 4) 80 m 20,000 m²
Festival invitation (Layer 5) 126 m 50,000 m²
In-festival voting (Layer 6) 200 m 40,000 m²

Note: Tolerances are in integer meters.

---

🔐 Anti-Fraud Measures

1. GPS Spoofing Detection

How:

· Compare GPS with IP-based location.
· Compare GPS with last known location.
· Detect impossible travel speeds.

Action:

· If mismatch > 10 km → Flag for review.
· If impossible speed → Reject.

2. EXIF Validation

How:

· Check EXIF for required fields:
  · GPSLatitude
  · GPSLongitude
  · DateTimeOriginal
  · Make (device)
  · Model (device)

Action:

· Missing fields → Reject.
· Suspicious values → Flag.

3. AI Image Detection

How:

· Analyze image metadata.
· Check for AI-generated signatures.
· Cross-reference with known AI models.

Action:

· AI-detected → Reject.
· Suspicious → Flag for review.

---

🌍 Global Map Integration

Map Features

1. Display all festivals (with GPS coordinates).
2. Filter by country/state.
3. Show active exchanges.
4. Show voting scopes (visual circles).
5. Interactive zoom (from country to street level).

Map Data

Marker Type Color Size
Active festival 🟢 Green Large
Pending festival 🟡 Yellow Medium
Completed festival ⚪ Gray Small
Individual exchange 🔵 Blue Medium
Voting scope ⭕ Circle Dynamic

---

📊 Data Storage

GPS Data Table (Conceptual)

```sql
CREATE TABLE gps_verifications (
    id BIGINT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,  -- 'festival', 'photo', 'vote', 'exchange'
    latitude BIGINT NOT NULL,   -- Micro-degrees
    longitude BIGINT NOT NULL,  -- Micro-degrees
    target_lat BIGINT,
    target_lng BIGINT,
    distance_meters BIGINT,
    verified BOOLEAN NOT NULL,
    reason VARCHAR(200),
    timestamp TIMESTAMP NOT NULL,
    exif_data JSONB
);
```

All numeric values are integers (BigInt).

---

🛠️ Implementation Notes

BigInt Arithmetic

```javascript
// Distance in meters (integer)
const distanceMeters = BigInt(Math.floor(Math.sqrt(Number(distanceSquared))));
```

Note: We use Math.sqrt only for the final display, not for comparisons. Comparisons use distanceSquared directly.

Comparison Without Square Root

```javascript
// ✅ CORRECT: Compare squared distances
if (distanceSquared <= TOLERANCE_SQUARED) {
    // Within scope
}

// ❌ WRONG: Compare with square root (float)
if (Math.sqrt(distanceSquared) <= TOLERANCE) {
    // Float involved
}
```

---

📌 Summary

Aspect Value
GPS Storage BigInt Micro-Degrees
Distance Calculation Integer Arithmetic
Tolerances Integer Meters
Photo Verification EXIF + GPS + Timestamp
AI Detection Multi-Layer
Voting Scopes 7 Layers
Anti-Fraud 3-Layer Detection

---

✅ Compliance Checklist

☑ All GPS values are integers (BigInt).
☑ Distance calculations use integer arithmetic.
☑ No floating-point anywhere.
☑ EXIF validation mandatory.
☑ AI image detection enabled.
☑ Voting scopes enforced.
☑ Anti-fraud measures active.

---

© 2026 Arabian Eagle A.E.C
