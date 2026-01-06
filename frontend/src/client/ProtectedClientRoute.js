import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isClientLoggedIn } from "../utils/clientStorage";

export default function ProtectedClientRoute({ children }) {
  const location = useLocation();
  if (!isClientLoggedIn()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}


