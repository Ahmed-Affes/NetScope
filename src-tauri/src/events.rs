use serde::{Deserialize, Serialize};
use crate::model::{Alert, GraphDelta, SystemMetrics};

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct DeltaPayload {
    pub delta: GraphDelta,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MetricsPayload {
    pub metrics: SystemMetrics,
}

#[derive(Serialize, Deserialize, specta::Type, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AlertPayload {
    pub alert: Alert,
}
