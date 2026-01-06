import React from "react";
import { Navigate } from "react-router-dom";
import { isAdminLoggedIn } from "../utils/adminStorage";

export default function ProtectedAdminRoute({ children }) {
  if (!isAdminLoggedIn()) {
    return <Navigate to="/admin/login" replace />;
  }
  return children;
}


