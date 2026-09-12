import { useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Polygon,
} from "react-leaflet";
import L from "leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";

const INITIAL_AMBULANCES = [
  {
    id: "A",
    lat: 24.75,
    lng: 46.62,
    status: "Available",
    zone: "Zone 1",
    speed: 60,
    traffic: 1.1,
  },
  {
    id: "B",
    lat: 24.75,
    lng: 46.72,
    status: "Available",
    zone: "Zone 2",
    speed: 55,
    traffic: 1.25,
  },
  {
    id: "C",
    lat: 24.68,
    lng: 46.62,
    status: "Available",
    zone: "Zone 3",
    speed: 65,
    traffic: 1.15,
  },
  {
    id: "D",
    lat: 24.68,
    lng: 46.72,
    status: "Available",
    zone: "Zone 4",
    speed: 58,
    traffic: 1.05,
  },
];

const INITIAL_EMERGENCIES = [
  {
    id: 102,
    lat: 24.715,
    lng: 46.67,
    severity: "CRITICAL",
    type: "Medical Emergency",
    status: "Active",
  },
];

const zones = [
  [
    [24.775, 46.585],
    [24.775, 46.655],
    [24.725, 46.655],
    [24.725, 46.585],
  ],
  [
    [24.775, 46.685],
    [24.775, 46.755],
    [24.725, 46.755],
    [24.725, 46.685],
  ],
  [
    [24.705, 46.585],
    [24.705, 46.655],
    [24.655, 46.655],
    [24.655, 46.585],
  ],
  [
    [24.705, 46.685],
    [24.705, 46.755],
    [24.655, 46.755],
    [24.655, 46.685],
  ],
];

const ambulanceIcon = L.divIcon({
  html: `
    <div class="ambulance-icon">
      <div class="ambulance-body">
        <div class="ambulance-window"></div>
        <div class="ambulance-window"></div>
        <div class="ambulance-red-cross">+</div>
      </div>

      <div class="ambulance-wheel wheel-left"></div>
      <div class="ambulance-wheel wheel-right"></div>
    </div>
  `,
  className: "",
  iconSize: [46, 38],
  iconAnchor: [23, 19],
});

const emergencyIcon = L.divIcon({
  html: `
    <div class="emergency-marker">!</div>
  `,
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function App() {
  const [ambulances, setAmbulances] = useState(
    INITIAL_AMBULANCES
  );

  const [emergencies, setEmergencies] = useState(
    INITIAL_EMERGENCIES
  );

  const [selectedEmergency, setSelectedEmergency] =
    useState(INITIAL_EMERGENCIES[0]);

  const [results, setResults] = useState([]);

  const [recommendation, setRecommendation] =
    useState(null);

  const [futureAnalysis, setFutureAnalysis] =
    useState(null);

  const [route, setRoute] = useState([]);

  const [simulationRunning, setSimulationRunning] =
    useState(false);

  const [showZones, setShowZones] = useState(true);

  const [activeTab, setActiveTab] =
    useState("overview");

  /*
   * ==========================================
   * 50-CASE IMPACT SIMULATION RESULTS
   * ==========================================
   */

  const [impactSimulation, setImpactSimulation] =
    useState(null);

  /*
   * ==========================================
   * DISTANCE CALCULATION
   * ==========================================
   *
   * Haversine formula calculates geographic
   * distance between two coordinates.
   *
   * Result = kilometers.
   */

  const calculateDistance = (
    lat1,
    lng1,
    lat2,
    lng2
  ) => {
    const earthRadius = 6371;

    const toRadians = (degrees) =>
      (degrees * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const lat1Radians = toRadians(lat1);
    const lat2Radians = toRadians(lat2);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1Radians) *
        Math.cos(lat2Radians) *
        Math.sin(dLng / 2) ** 2;

    const c =
      2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      );

    const straightLineDistance =
      earthRadius * c;

    /*
     * Approximate road distance.
     */
    const roadDistance =
      straightLineDistance * 1.3;

    return roadDistance;
  };

  /*
   * ==========================================
   * ETA CALCULATION
   * ==========================================
   */

  const calculateETA = (
    distance,
    speed,
    trafficFactor
  ) => {
    const baseTimeHours =
      distance / speed;

    const baseTimeMinutes =
      baseTimeHours * 60;

    const trafficAdjustedETA =
      baseTimeMinutes *
      trafficFactor;

    return Math.max(
      2,
      Math.round(trafficAdjustedETA)
    );
  };

  /*
   * ==========================================
   * COVERAGE
   * ==========================================
   */

  const calculateCoverage = (
    eta,
    zone
  ) => {
    const zoneBonus =
      zone === "Zone 4" ? 3 : 0;

    return Math.max(
      60,
      Math.min(
        98,
        100 - eta + zoneBonus
      )
    );
  };

  /*
   * ==========================================
   * RISK
   * ==========================================
   */

  const getRisk = (coverage) => {
    if (coverage >= 85) {
      return "LOW";
    }

    if (coverage >= 75) {
      return "MEDIUM";
    }

    return "HIGH";
  };

  /*
   * ==========================================
   * DISPATCH SIMULATION
   * ==========================================
   */

  const simulateDispatch = () => {
    if (!selectedEmergency) {
      return;
    }

    setSimulationRunning(true);

    const simulatedResults =
      ambulances
        .filter(
          (ambulance) =>
            ambulance.status !== "Busy"
        )
        .map((ambulance) => {
          const distance =
            calculateDistance(
              ambulance.lat,
              ambulance.lng,
              selectedEmergency.lat,
              selectedEmergency.lng
            );

          const eta =
            calculateETA(
              distance,
              ambulance.speed,
              ambulance.traffic
            );

          const coverage =
            calculateCoverage(
              eta,
              ambulance.zone
            );

          const risk =
            getRisk(coverage);

          /*
           * NABD score.
           *
           * Lower ETA is strongly preferred,
           * while coverage is also considered.
           */

          const score =
            100 -
            eta * 4 +
            coverage;

          return {
            ...ambulance,
            distance,
            eta,
            coverage,
            risk,
            score,
          };
        })
        .sort(
          (a, b) =>
            b.score - a.score
        );

    if (
      simulatedResults.length === 0
    ) {
      setSimulationRunning(false);
      return;
    }

    const selectedUnit =
      simulatedResults[0];

    setResults(simulatedResults);

    setRecommendation(selectedUnit);

    /*
     * Simulated route line.
     *
     * This is not a real road route.
     */

    setRoute([
      [
        selectedUnit.lat,
        selectedUnit.lng,
      ],
      [
        selectedEmergency.lat,
        selectedEmergency.lng,
      ],
    ]);

    /*
     * ==========================================
     * FUTURE COVERAGE ANALYSIS
     * ==========================================
     */

    const beforeCoverage = 92;

    const afterCoverage =
      Math.max(
        64,
        beforeCoverage -
          selectedUnit.eta * 3
      );

    const coverageDrop =
      beforeCoverage -
      afterCoverage;

    const futureRisk =
      getRisk(afterCoverage);

    /*
     * Vulnerable zone.
     */

    const vulnerableZone =
      selectedUnit.zone === "Zone 1"
        ? "Zone 3"
        : selectedUnit.zone === "Zone 2"
        ? "Zone 4"
        : selectedUnit.zone === "Zone 3"
        ? "Zone 1"
        : "Zone 2";

    /*
     * Repositioning recommendation.
     */

    const repositionUnit =
      simulatedResults.find(
        (unit) =>
          unit.id !==
          selectedUnit.id
      );

    setFutureAnalysis({
      beforeCoverage,
      afterCoverage,
      coverageDrop,
      futureRisk,
      vulnerableZone,
      repositionUnit:
        repositionUnit
          ? repositionUnit.id
          : "D",
      recommendation:
        afterCoverage < 80
          ? "REPOSITION REQUIRED"
          : "NETWORK STABLE",
    });

    setSimulationRunning(false);
  };

  /*
   * ==========================================
   * 50-CASE IMPACT SIMULATION
   * ==========================================
   *
   * BEFORE NABD:
   * Nearest ambulance based on distance.
   *
   * AFTER NABD:
   * Best ambulance based on NABD score.
   *
   * This creates 50 simulated emergency
   * scenarios and compares both approaches.
   */

  const runImpactSimulation = () => {
    setSimulationRunning(true);

    const cases = [];

    const availableAmbulances =
      ambulances.filter(
        (ambulance) =>
          ambulance.status !== "Busy"
      );

    /*
     * Make sure there are ambulances
     * available for the simulation.
     */

    if (
      availableAmbulances.length === 0
    ) {
      setSimulationRunning(false);
      return;
    }

    /*
     * Generate 50 emergency scenarios.
     */

    for (let i = 0; i < 50; i++) {
      /*
       * Random emergency location inside
       * the demonstration area.
       */

      const emergency = {
        lat:
          24.655 +
          Math.random() *
            (24.775 - 24.655),

        lng:
          46.585 +
          Math.random() *
            (46.755 - 46.585),
      };

      /*
       * Analyze every ambulance.
       */

      const analyzedUnits =
        availableAmbulances.map(
          (ambulance) => {
            const distance =
              calculateDistance(
                ambulance.lat,
                ambulance.lng,
                emergency.lat,
                emergency.lng
              );

            const eta =
              calculateETA(
                distance,
                ambulance.speed,
                ambulance.traffic
              );

            const coverage =
              calculateCoverage(
                eta,
                ambulance.zone
              );

            const risk =
              getRisk(coverage);

            const score =
              100 -
              eta * 4 +
              coverage;

            return {
              ...ambulance,
              distance,
              eta,
              coverage,
              risk,
              score,
            };
          }
        );

      /*
       * ========================================
       * BEFORE NABD
       * ========================================
       *
       * Traditional baseline:
       * choose the geographically closest
       * ambulance.
       */

      const beforeUnit =
        [...analyzedUnits].sort(
          (a, b) =>
            a.distance - b.distance
        )[0];

      /*
       * ========================================
       * AFTER NABD
       * ========================================
       *
       * NABD:
       * choose the highest scoring unit.
       */

      const afterUnit =
        [...analyzedUnits].sort(
          (a, b) =>
            b.score - a.score
        )[0];

      /*
       * Time saved.
       */

      const improvement =
        beforeUnit.eta -
        afterUnit.eta;

      const improvementPercent =
        beforeUnit.eta > 0
          ? (improvement /
              beforeUnit.eta) *
            100
          : 0;

      cases.push({
        caseNumber: i + 1,

        beforeUnit:
          beforeUnit.id,

        afterUnit:
          afterUnit.id,

        beforeETA:
          beforeUnit.eta,

        afterETA:
          afterUnit.eta,

        improvement,

        improvementPercent,

        beforeDistance:
          beforeUnit.distance,

        afterDistance:
          afterUnit.distance,

        beforeCoverage:
          beforeUnit.coverage,

        afterCoverage:
          afterUnit.coverage,
      });
    }

    /*
     * ========================================
     * CALCULATE FINAL STATISTICS
     * ========================================
     */

    const totalCases =
      cases.length;

    const averageBefore =
      cases.reduce(
        (sum, item) =>
          sum + item.beforeETA,
        0
      ) / totalCases;

    const averageAfter =
      cases.reduce(
        (sum, item) =>
          sum + item.afterETA,
        0
      ) / totalCases;

    const averageImprovement =
      averageBefore -
      averageAfter;

    const improvementPercent =
      averageBefore > 0
        ? (averageImprovement /
            averageBefore) *
          100
        : 0;

    const improvedCases =
      cases.filter(
        (item) =>
          item.afterETA <
          item.beforeETA
      ).length;

    const sameCases =
      cases.filter(
        (item) =>
          item.afterETA ===
          item.beforeETA
      ).length;

    const slowerCases =
      cases.filter(
        (item) =>
          item.afterETA >
          item.beforeETA
      ).length;

    const averageBeforeCoverage =
      cases.reduce(
        (sum, item) =>
          sum + item.beforeCoverage,
        0
      ) / totalCases;

    const averageAfterCoverage =
      cases.reduce(
        (sum, item) =>
          sum + item.afterCoverage,
        0
      ) / totalCases;

    /*
     * Save simulation results.
     */

    setImpactSimulation({
      cases,
      totalCases,
      averageBefore,
      averageAfter,
      averageImprovement,
      improvementPercent,
      improvedCases,
      sameCases,
      slowerCases,
      averageBeforeCoverage,
      averageAfterCoverage,
    });

    setSimulationRunning(false);
  };

  /*
   * ==========================================
   * ADD EMERGENCY
   * ==========================================
   */

  const addEmergency = () => {
    const newEmergency = {
      id: 103 + emergencies.length,
      lat: 24.7,
      lng: 46.69,
      severity: "HIGH",
      type: "Traffic Accident",
      status: "Active",
    };

    setEmergencies([
      ...emergencies,
      newEmergency,
    ]);

    setSelectedEmergency(
      newEmergency
    );

    setResults([]);
    setRecommendation(null);
    setFutureAnalysis(null);
    setRoute([]);
  };

  /*
   * ==========================================
   * RESET
   * ==========================================
   */

  const resetSimulation = () => {
    setAmbulances(
      INITIAL_AMBULANCES
    );

    setEmergencies(
      INITIAL_EMERGENCIES
    );

    setSelectedEmergency(
      INITIAL_EMERGENCIES[0]
    );

    setResults([]);
    setRecommendation(null);
    setFutureAnalysis(null);
    setRoute([]);
    setImpactSimulation(null);
    setSimulationRunning(false);
  };

  /*
   * ==========================================
   * DASHBOARD METRICS
   * ==========================================
   */

  const metrics = useMemo(() => {
    const available =
      ambulances.filter(
        (ambulance) =>
          ambulance.status ===
          "Available"
      ).length;

    const activeCalls =
      emergencies.filter(
        (emergency) =>
          emergency.status ===
          "Active"
      ).length;

    const averageETA =
      results.length
        ? Math.round(
            results.reduce(
              (sum, item) =>
                sum + item.eta,
              0
            ) / results.length
          )
        : 7;

    const networkCoverage =
      futureAnalysis
        ? futureAnalysis.afterCoverage
        : 92;

    return {
      available,
      activeCalls,
      averageETA,
      networkCoverage,
    };
  }, [
    ambulances,
    emergencies,
    results,
    futureAnalysis,
  ]);

  return (
    <div className="app">

      {/* ================= HEADER ================= */}

      <header className="header">

        <div className="brand">

          <div className="brand-icon">
            N
          </div>

          <div>

            <h1>
              NABD
            </h1>

            <p>
              Intelligent Ambulance
              Positioning System
            </p>

          </div>

        </div>

        <div className="system-status">

          <span className="status-dot"></span>

          SYSTEM ONLINE

        </div>

      </header>

      {/* ================= NAVIGATION ================= */}

      <nav className="nav">

        <button
          className={
            activeTab === "overview"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("overview")
          }
        >
          Overview
        </button>

        <button
          className={
            activeTab === "network"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("network")
          }
        >
          Network
        </button>

        <button
          className={
            activeTab === "future"
              ? "nav-button active"
              : "nav-button"
          }
          onClick={() =>
            setActiveTab("future")
          }
        >
          Future Impact
        </button>

      </nav>

      {/* ================= METRICS ================= */}

      <section className="metrics">

        <div className="metric-card">

          <span>
            Available Units
          </span>

          <strong>
            {metrics.available}
          </strong>

          <small>
            Ready for dispatch
          </small>

        </div>

        <div className="metric-card">

          <span>
            Active Emergencies
          </span>

          <strong>
            {metrics.activeCalls}
          </strong>

          <small>
            Requires attention
          </small>

        </div>

        <div className="metric-card">

          <span>
            Average ETA
          </span>

          <strong>
            {metrics.averageETA} min
          </strong>

          <small>
            Estimated response
          </small>

        </div>

        <div className="metric-card">

          <span>
            Network Coverage
          </span>

          <strong>
            {metrics.networkCoverage}%
          </strong>

          <small>
            City readiness
          </small>

        </div>

      </section>

      {/* ================= CONTROL ================= */}

      <section className="control-card">

        <div>

          <div className="section-label">
            ACTIVE EMERGENCY
          </div>

          <h2>
            Emergency #
            {selectedEmergency.id}
          </h2>

          <p>
            {selectedEmergency.type}
            {" · "}
            Severity:
            {" "}
            <strong>
              {selectedEmergency.severity}
            </strong>
          </p>

        </div>

        <div className="control-buttons">

          <button
            className="secondary-button"
            onClick={addEmergency}
          >
            Add Emergency
          </button>

          <button
            className="primary-button"
            onClick={
              simulateDispatch
            }
            disabled={
              simulationRunning
            }
          >
            {simulationRunning
              ? "ANALYZING..."
              : "SIMULATE DISPATCH"}
          </button>

          <button
            className="primary-button"
            onClick={
              runImpactSimulation
            }
            disabled={
              simulationRunning
            }
          >
            {simulationRunning
              ? "RUNNING 50 CASES..."
              : "RUN 50 SIMULATIONS"}
          </button>

          <button
            className="reset-button"
            onClick={
              resetSimulation
            }
          >
            RESET
          </button>

        </div>

      </section>

      {/* ================= MAIN ================= */}

      <main className="main-grid">

        {/* ================= MAP ================= */}

        <section className="map-card">

          <div className="card-header">

            <div>

              <h2>
                Live Emergency Network
              </h2>

              <p>
                Real-time simulated
                ambulance positioning
              </p>

            </div>

            <button
              className="zone-button"
              onClick={() =>
                setShowZones(
                  !showZones
                )
              }
            >
              {showZones
                ? "Hide Zones"
                : "Show Zones"}
            </button>

          </div>

          <MapContainer
            center={[
              24.715,
              46.67,
            ]}
            zoom={12}
            className="map"
          >

            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {showZones &&
              zones.map(
                (zone, index) => (
                  <Polygon
                    key={index}
                    positions={zone}
                    pathOptions={{
                      color:
                        "#2563eb",
                      weight: 1,
                      fillOpacity:
                        0.06,
                    }}
                  />
                )
              )}

            {/* Ambulances */}

            {ambulances.map(
              (ambulance) => (
                <Marker
                  key={
                    ambulance.id
                  }
                  position={[
                    ambulance.lat,
                    ambulance.lng,
                  ]}
                  icon={
                    ambulanceIcon
                  }
                >

                  <Popup>

                    <strong>
                      Ambulance Unit{" "}
                      {ambulance.id}
                    </strong>

                    <br />

                    Status:
                    {" "}
                    {ambulance.status}

                    <br />

                    Zone:
                    {" "}
                    {ambulance.zone}

                    <br />

                    Speed:
                    {" "}
                    {ambulance.speed}
                    {" km/h"}

                    <br />

                    Traffic:
                    {" "}
                    {ambulance.traffic <= 1.1
                      ? "Low"
                      : ambulance.traffic <= 1.25
                      ? "Moderate"
                      : "High"}

                  </Popup>

                </Marker>
              )
            )}

            {/* Emergencies */}

            {emergencies.map(
              (emergency) => (
                <Marker
                  key={
                    emergency.id
                  }
                  position={[
                    emergency.lat,
                    emergency.lng,
                  ]}
                  icon={
                    emergencyIcon
                  }
                >

                  <Popup>

                    <strong>
                      Emergency #
                      {emergency.id}
                    </strong>

                    <br />

                    Type:
                    {" "}
                    {emergency.type}

                    <br />

                    Severity:
                    {" "}
                    {emergency.severity}

                  </Popup>

                </Marker>
              )
            )}

            {/* Recommended Route */}

            {route.length > 0 && (
              <Polyline
                positions={route}
                pathOptions={{
                  color:
                    "#2563eb",
                  weight: 5,
                  opacity: 0.8,
                }}
              />
            )}

          </MapContainer>

          <div className="map-legend">

            <div>

              <span className="legend-dot blue"></span>

              Available Unit

            </div>

            <div>

              <span className="legend-dot red"></span>

              Emergency

            </div>

            <div>

              <span className="legend-line"></span>

              Recommended Route

            </div>

          </div>

        </section>

        {/* ================= ANALYSIS ================= */}

        <section className="analysis-column">

          {recommendation ? (

            <div className="recommendation-card">

              <div className="success-label">
                OPTIMAL DECISION
              </div>

              <h2>
                NABD Recommendation
              </h2>

              <div className="recommended-unit">
                Unit{" "}
                {recommendation.id}
              </div>

              <p>
                Best balance between
                response time and
                network coverage.
              </p>

              <div className="recommendation-stats">

                <div>

                  <span>
                    ETA:
                  </span>

                  <strong>
                    {recommendation.eta} min
                  </strong>

                </div>

                <div>

                  <span>
                    Distance:
                  </span>

                  <strong>
                    {recommendation.distance.toFixed(
                      1
                    )} km
                  </strong>

                </div>

                <div>

                  <span>
                    Coverage:
                  </span>

                  <strong>
                    {recommendation.coverage}%
                  </strong>

                </div>

                <div>

                  <span>
                    Risk:
                  </span>

                  <strong>
                    {recommendation.risk}
                  </strong>

                </div>

              </div>

            </div>

          ) : (

            <div className="empty-card">

              <div className="empty-icon">
                N
              </div>

              <h2>
                Awaiting Simulation
              </h2>

              <p>
                Run the dispatch
                simulation to receive
                an optimal ambulance
                recommendation.
              </p>

            </div>

          )}

          {/* ================= UNIT ANALYSIS ================= */}

          <div className="analysis-card">

            <div className="card-header">

              <div>

                <h2>
                  Unit Analysis
                </h2>

                <p>
                  Compare available
                  units
                </p>

              </div>

            </div>

            {results.length > 0 ? (

              <div className="table-wrapper">

                <table>

                  <thead>

                    <tr>

                      <th>
                        Unit
                      </th>

                      <th>
                        Distance
                      </th>

                      <th>
                        ETA
                      </th>

                      <th>
                        Coverage
                      </th>

                      <th>
                        Risk
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {results.map(
                      (unit) => (
                        <tr
                          key={
                            unit.id
                          }
                          className={
                            recommendation?.id ===
                            unit.id
                              ? "recommended-row"
                              : ""
                          }
                        >

                          <td>
                            Unit{" "}
                            {unit.id}
                          </td>

                          <td>
                            {unit.distance.toFixed(
                              1
                            )}
                            {" km"}
                          </td>

                          <td>
                            {unit.eta}
                            {" min"}
                          </td>

                          <td>
                            {unit.coverage}%
                          </td>

                          <td>

                            <span
                              className={
                                `risk ${unit.risk.toLowerCase()}`
                              }
                            >
                              {unit.risk}
                            </span>

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            ) : (

              <div className="empty-table">
                No simulation results yet.
              </div>

            )}

          </div>

        </section>

      </main>

      {/* ================= 50-CASE IMPACT ================= */}

      {impactSimulation && (

        <section className="future-section">

          <div className="future-title">

            <div>

              <div className="section-label">
                PERFORMANCE VALIDATION
              </div>

              <h2>
                50-Case Impact Simulation
              </h2>

              <p>
                Comparison between
                traditional nearest-unit
                dispatch and NABD
                decision-making.
              </p>

            </div>

          </div>

          <div className="future-grid">

            <div className="coverage-card">

              <span>
                BEFORE NABD
              </span>

              <strong>
                {impactSimulation.averageBefore.toFixed(
                  1
                )}
                {" min"}
              </strong>

              <small>
                Average response time
              </small>

            </div>

            <div className="future-arrow">
              →
            </div>

            <div className="coverage-card after">

              <span>
                AFTER NABD
              </span>

              <strong>
                {impactSimulation.averageAfter.toFixed(
                  1
                )}
                {" min"}
              </strong>

              <small>
                Average response time
              </small>

            </div>

            <div className="coverage-card warning">

              <span>
                IMPROVEMENT
              </span>

              <strong>
                {Math.max(
                  0,
                  impactSimulation.improvementPercent
                ).toFixed(1)}
                %
              </strong>

              <small>
                Average response improvement
              </small>

            </div>

          </div>

          <div className="future-bottom">

            <div className="risk-card">

              <div className="risk-icon">
                ✓
              </div>

              <div>

                <span>
                  CASES IMPROVED
                </span>

                <h3>
                  {impactSimulation.improvedCases}
                  {" / "}
                  {impactSimulation.totalCases}
                </h3>

                <p>
                  Emergency scenarios where
                  NABD achieved a faster ETA.
                </p>

              </div>

            </div>

            <div className="reposition-card">

              <div className="reposition-icon">
                %
              </div>

              <div>

                <span>
                  AVERAGE TIME SAVED
                </span>

                <h3>
                  {Math.max(
                    0,
                    impactSimulation.averageImprovement
                  ).toFixed(1)}
                  {" min"}
                </h3>

                <p>
                  Average response time
                  difference per emergency.
                </p>

              </div>

            </div>

          </div>

          <div className="decision-banner">

            <div className="decision-check">
              ✓
            </div>

            <div>

              <strong>
                Simulation Result:
              </strong>

              {" "}

              NABD changed the average
              response time from{" "}

              <strong>
                {impactSimulation.averageBefore.toFixed(
                  1
                )}
                {" min"}
              </strong>

              {" "}to{" "}

              <strong>
                {impactSimulation.averageAfter.toFixed(
                  1
                )}
                {" min"}
              </strong>

              {" "}
              across{" "}

              <strong>
                {impactSimulation.totalCases}
              </strong>

              {" "}
              simulated emergency
              scenarios.

            </div>

          </div>

          {/* ================= SIMULATION SUMMARY ================= */}

          <div className="analysis-card">

            <div className="card-header">

              <div>

                <h2>
                  Simulation Summary
                </h2>

                <p>
                  Overall performance across
                  50 emergency scenarios
                </p>

              </div>

            </div>

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>

                    <th>
                      Metric
                    </th>

                    <th>
                      Result
                    </th>

                  </tr>

                </thead>

                <tbody>

                  <tr>

                    <td>
                      Total scenarios
                    </td>

                    <td>
                      {impactSimulation.totalCases}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Average ETA Before
                    </td>

                    <td>
                      {impactSimulation.averageBefore.toFixed(
                        1
                      )}
                      {" min"}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Average ETA After
                    </td>

                    <td>
                      {impactSimulation.averageAfter.toFixed(
                        1
                      )}
                      {" min"}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Average Difference
                    </td>

                    <td>
                      {impactSimulation.averageImprovement.toFixed(
                        1
                      )}
                      {" min"}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Cases Improved
                    </td>

                    <td>
                      {impactSimulation.improvedCases}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Same ETA
                    </td>

                    <td>
                      {impactSimulation.sameCases}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Slower Cases
                    </td>

                    <td>
                      {impactSimulation.slowerCases}
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Average Coverage Before
                    </td>

                    <td>
                      {impactSimulation.averageBeforeCoverage.toFixed(
                        1
                      )}
                      %
                    </td>

                  </tr>

                  <tr>

                    <td>
                      Average Coverage After
                    </td>

                    <td>
                      {impactSimulation.averageAfterCoverage.toFixed(
                        1
                      )}
                      %
                    </td>

                  </tr>

                </tbody>

              </table>

            </div>

          </div>

          {/* ================= CASE TABLE ================= */}

          <div className="analysis-card">

            <div className="card-header">

              <div>

                <h2>
                  50 Simulation Cases
                </h2>

                <p>
                  Before vs. NABD decision
                </p>

              </div>

            </div>

            <div className="table-wrapper">

              <table>

                <thead>

                  <tr>

                    <th>
                      Case
                    </th>

                    <th>
                      Before
                    </th>

                    <th>
                      NABD
                    </th>

                    <th>
                      Difference
                    </th>

                    <th>
                      Before Unit
                    </th>

                    <th>
                      NABD Unit
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {impactSimulation.cases.map(
                    (item) => (
                      <tr
                        key={
                          item.caseNumber
                        }
                      >

                        <td>
                          #{item.caseNumber}
                        </td>

                        <td>
                          {item.beforeETA}
                          {" min"}
                        </td>

                        <td>
                          {item.afterETA}
                          {" min"}
                        </td>

                        <td>

                          <span
                            className={
                              item.improvement > 0
                                ? "risk low"
                                : item.improvement < 0
                                ? "risk high"
                                : "risk medium"
                            }
                          >

                            {item.improvement > 0
                              ? `-${item.improvement} min`
                              : item.improvement < 0
                              ? `+${Math.abs(
                                  item.improvement
                                )} min`
                              : "0 min"}

                          </span>

                        </td>

                        <td>
                          Unit{" "}
                          {item.beforeUnit}
                        </td>

                        <td>
                          Unit{" "}
                          {item.afterUnit}
                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>

        </section>

      )}

      {/* ================= FUTURE IMPACT ================= */}

      {futureAnalysis && (

        <section className="future-section">

          <div className="future-title">

            <div>

              <div className="section-label">
                PREDICTIVE ANALYSIS
              </div>

              <h2>
                Future Impact Analysis
              </h2>

              <p>
                What happens to the
                emergency network
                after dispatch?
              </p>

            </div>

          </div>

          <div className="future-grid">

            <div className="coverage-card">

              <span>
                BEFORE DISPATCH:
              </span>

              <strong>
                {futureAnalysis.beforeCoverage}%
              </strong>

              <small>
                Current network
                coverage
              </small>

            </div>

            <div className="future-arrow">
              →
            </div>

            <div className="coverage-card after">

              <span>
                AFTER DISPATCH:
              </span>

              <strong>
                {futureAnalysis.afterCoverage}%
              </strong>

              <small>
                Predicted network
                coverage
              </small>

            </div>

            <div className="coverage-card warning">

              <span>
                COVERAGE CHANGE:
              </span>

              <strong>
                -
                {
                  futureAnalysis.coverageDrop
                }%
              </strong>

              <small>
                Predicted impact
              </small>

            </div>

          </div>

          <div className="future-bottom">

            <div className="risk-card">

              <div className="risk-icon">
                !
              </div>

              <div>

                <span>
                  FUTURE COVERAGE RISK
                </span>

                <h3>
                  {
                    futureAnalysis.futureRisk
                  }
                </h3>

                <p>
                  Dispatching the
                  selected unit may
                  create a coverage
                  gap in another area.
                </p>

              </div>

            </div>

            <div className="reposition-card">

              <div className="reposition-icon">
                ↻
              </div>

              <div>

                <span>
                  RECOMMENDED
                  REPOSITIONING
                </span>

                <h3>
                  Move Unit{" "}
                  {
                    futureAnalysis.repositionUnit
                  }
                  {" → "}
                  {
                    futureAnalysis.vulnerableZone
                  }
                </h3>

                <p>
                  Maintain emergency
                  readiness in the
                  affected zone after
                  dispatch.
                </p>

              </div>

            </div>

          </div>

          <div className="decision-banner">

            <div className="decision-check">
              ✓
            </div>

            <div>

              <strong>
                NABD Decision:
              </strong>

              {" "}

              {
                futureAnalysis.recommendation
              }

            </div>

          </div>

        </section>

      )}

      {/* ================= HOW NABD WORKS ================= */}

      <section className="how-section">

        <div className="section-label">
          HOW NABD WORKS
        </div>

        <h2>
          From emergency call to
          smarter positioning
        </h2>

        <div className="steps">

          <div className="step">

            <div className="step-number">
              1
            </div>

            <h3>
              Emergency Detected
            </h3>

            <p>
              A new emergency request
              enters the system.
            </p>

          </div>

          <div className="step">

            <div className="step-number">
              2
            </div>

            <h3>
              Network Analysis
            </h3>

            <p>
              NABD compares available
              ambulance units using
              distance, speed and
              traffic conditions.
            </p>

          </div>

          <div className="step">

            <div className="step-number">
              3
            </div>

            <h3>
              Optimal Dispatch
            </h3>

            <p>
              The system selects the
              best response option.
            </p>

          </div>

          <div className="step">

            <div className="step-number">
              4
            </div>

            <h3>
              Future Protection
            </h3>

            <p>
              NABD predicts coverage
              gaps and recommends
              repositioning.
            </p>

          </div>

        </div>

      </section>

      {/* ================= FOOTER ================= */}

      <footer className="footer">

        <strong>
          NABD
        </strong>

        <span>
          Predictive Ambulance
          Network Optimization
          Prototype
        </span>

        <span>
          Hackathon Prototype
        </span>

      </footer>

    </div>
  );
}

export default App;