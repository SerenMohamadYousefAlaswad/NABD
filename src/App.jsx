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
  },
  {
    id: "B",
    lat: 24.75,
    lng: 46.72,
    status: "Available",
    zone: "Zone 2",
  },
  {
    id: "C",
    lat: 24.68,
    lng: 46.62,
    status: "Available",
    zone: "Zone 3",
  },
  {
    id: "D",
    lat: 24.68,
    lng: 46.72,
    status: "Available",
    zone: "Zone 4",
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

  const calculateDistance = (
    lat1,
    lng1,
    lat2,
    lng2
  ) => {
    const latDifference = lat1 - lat2;
    const lngDifference = lng1 - lng2;

    return Math.sqrt(
      latDifference ** 2 +
        lngDifference ** 2
    );
  };

  const calculateETA = (distance) => {
    return Math.max(
      3,
      Math.round(distance * 1000)
    );
  };

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

  const getRisk = (coverage) => {
    if (coverage >= 85) {
      return "LOW";
    }

    if (coverage >= 75) {
      return "MEDIUM";
    }

    return "HIGH";
  };

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
            calculateETA(distance);

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

    const vulnerableZone =
      selectedUnit.zone === "Zone 1"
        ? "Zone 3"
        : selectedUnit.zone === "Zone 2"
        ? "Zone 4"
        : selectedUnit.zone === "Zone 3"
        ? "Zone 1"
        : "Zone 2";

    const repositionUnit =
      simulatedResults.find(
        (unit) =>
          unit.id !== selectedUnit.id
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
    setSimulationRunning(false);
  };

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

      <header className="header">

        <div className="brand">

          <div className="brand-icon">
            N
          </div>

          <div>
            <h1>NABD</h1>

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
            className="reset-button"
            onClick={
              resetSimulation
            }
          >
            RESET
          </button>

        </div>

      </section>

      <main className="main-grid">

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

                  </Popup>

                </Marker>
              )
            )}

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
                            {unit.eta} min
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
              ambulance units.
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