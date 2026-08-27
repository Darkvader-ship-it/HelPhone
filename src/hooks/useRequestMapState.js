import { useCallback, useMemo, useState } from "react";

export function useRequestMapState({ defaultCenter }) {
  const [requestId, setRequestId] = useState(null);
  const [requestStatus, setRequestStatus] = useState("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [responders, setResponders] = useState([]);
  const [popupMarker, setPopupMarker] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [myRequestsLoading, setMyRequestsLoading] = useState(false);
  const [openRequests, setOpenRequests] = useState(new globalThis.Map());
  const [openRequestsLoading, setOpenRequestsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [lastOfferReceipt, setLastOfferReceipt] = useState(null);
  const [trackingRequestId, setTrackingRequestId] = useState(null);
  const [trackingIndex, setTrackingIndex] = useState(null);
  const [responderArrived, setResponderArrived] = useState(false);
  const [arrivalSubmitting, setArrivalSubmitting] = useState(false);
  const [arrivalThanksOpen, setArrivalThanksOpen] = useState(false);
  const [requesterLocation, setRequesterLocation] = useState(null);
  const [settledViewport, setSettledViewport] = useState(() => ({
    longitude: defaultCenter[1],
    latitude: defaultCenter[0],
    zoom: 2,
  }));

  const openRequestsArray = useMemo(
    () => Array.from(openRequests.values()),
    [openRequests],
  );

  const syncSettledViewport = useCallback((event) => {
    const viewState = event?.viewState;
    if (!viewState) return;
    setSettledViewport({
      longitude: viewState.longitude,
      latitude: viewState.latitude,
      zoom: viewState.zoom,
      pitch: viewState.pitch,
      bearing: viewState.bearing,
    });
  }, []);

  return {
    requestId,
    setRequestId,
    requestStatus,
    setRequestStatus,
    submitting,
    setSubmitting,
    submitError,
    setSubmitError,
    requestError,
    setRequestError,
    responders,
    setResponders,
    popupMarker,
    setPopupMarker,
    myRequests,
    setMyRequests,
    myRequestsLoading,
    setMyRequestsLoading,
    openRequests,
    setOpenRequests,
    openRequestsLoading,
    setOpenRequestsLoading,
    openRequestsArray,
    selectedRequest,
    setSelectedRequest,
    offerSubmitting,
    setOfferSubmitting,
    lastOfferReceipt,
    setLastOfferReceipt,
    trackingRequestId,
    setTrackingRequestId,
    trackingIndex,
    setTrackingIndex,
    responderArrived,
    setResponderArrived,
    arrivalSubmitting,
    setArrivalSubmitting,
    arrivalThanksOpen,
    setArrivalThanksOpen,
    requesterLocation,
    setRequesterLocation,
    settledViewport,
    syncSettledViewport,
  };
}
