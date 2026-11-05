import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHeading, computeSpeedKmh, mapPayload, routeProgress } from './trackingData.js';

test('routeProgress splits GeoJSON route coordinates and computes progress metrics', () => {
  const routeCoords = [
    [106.6602, 10.7626],
    [106.6800, 10.7800],
    [106.7000, 10.8000],
  ];
  const current = { latitude: 10.7802, longitude: 106.6801 };
  const gpsSegments = [
    [
      { latitude: 10.7626, longitude: 106.6602 },
      { latitude: 10.7802, longitude: 106.6801 },
    ],
  ];
  const progress = routeProgress(routeCoords, current, gpsSegments, { durationSeconds: 1200 });
  assert.ok(progress.traveledMeters > 2000);
  assert.ok(progress.remainingMeters > 2000);
  assert.ok(progress.progressRatio > 0.3 && progress.progressRatio < 0.7);
  assert.ok(progress.etaSeconds > 0 && progress.etaSeconds < 1200);
  assert.ok(progress.routePassed.length >= 2);
  assert.ok(progress.routeRemaining.length >= 2);
});

test('mapPayload builds traveled segments, heading, speed and route split without milestones', () => {
  const trip = {
    id: 'trip-1',
    routeVersion: 1,
    pickupPoint: { latitude: 10.7626, longitude: 106.6602, label: 'Kho A' },
    deliveryPoint: { latitude: 10.8000, longitude: 106.7000, label: 'Kho B' },
  };
  const tracking = {
    routeVersion: 1,
    pickupPoint: trip.pickupPoint,
    deliveryPoint: trip.deliveryPoint,
    routeGeometry: {
      type: 'LineString',
      coordinates: [
        [106.6602, 10.7626],
        [106.6800, 10.7800],
        [106.7000, 10.8000],
      ],
    },
    latestLocation: {
      id: 'p2',
      latitude: 10.7636,
      longitude: 106.6602,
      source: 'GPS',
      capturedAt: '2026-11-05T10:00:10.000Z',
    },
  };
  const points = [
    {
      id: 'p1',
      latitude: 10.7626,
      longitude: 106.6602,
      source: 'GPS',
      accuracyMeters: 8,
      capturedAt: '2026-11-05T10:00:00.000Z',
    },
    {
      id: 'p2',
      latitude: 10.7636,
      longitude: 106.6602,
      source: 'GPS',
      accuracyMeters: 8,
      capturedAt: '2026-11-05T10:00:10.000Z',
    },
  ];

  const payload = mapPayload({ trip, tracking, points });
  assert.equal('milestones' in payload, false);
  assert.equal(payload.segments.length, 1);
  assert.equal(payload.latest.heading, 0);
  assert.ok(payload.latest.speedKmh > 35 && payload.latest.speedKmh < 45);
  assert.ok(payload.routeRemaining.length >= 2);
});

