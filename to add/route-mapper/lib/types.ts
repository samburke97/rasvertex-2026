// lib/types.ts - Complete types for SimPRO API

// Core API Configuration
export interface SimproConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  companyId?: number;
}

export interface SimproAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
}

// Job and Attachment Types
export interface SimproAttachment {
  ID: string;
  Filename: string;
  Folder?: {
    ID: number;
    Name: string;
  } | null;
  Public: boolean;
  Email: boolean;
  MimeType: string;
  FileSizeBytes: number;
  DateAdded: string;
  AddedBy?: {
    ID: number;
    Name: string;
    Type: string;
    TypeId: number;
  } | null;
  Base64Data?: string;
}

export interface SimproJob {
  ID: number;
  Name: string;
  Description?: string;
  Status: string;
  Customer?: {
    ID: number;
    Name: string;
  };
  Site?: {
    ID: number;
    Name: string;
    Address?: string;
  };
  DateCreated: string;
  DateScheduled?: string;
}

// Address and Contact Types
export interface Address {
  Address: string;
  City: string;
  State: string;
  PostalCode: string;
  Country: string;
}

export interface PrimaryContact {
  Email: string;
  SecondaryEmail?: string;
  WorkPhone?: string;
  Extension?: string;
  CellPhone?: string;
  Fax?: string;
  PreferredNotificationMethod?: string;
}

// Customer and Site Types
export interface Customer {
  ID: number;
  CompanyName: string;
  GivenName: string;
  FamilyName: string;
}

export interface CustomerContact {
  ID: number;
  GivenName: string;
  FamilyName: string;
}

export interface Site {
  ID: number;
  Name: string;
}

export interface SiteContact {
  ID: number;
  GivenName: string;
  FamilyName: string;
}

// Staff Types
export interface SalespersonRef {
  ID: number;
  Name: string;
  Type: string;
  TypeId: number;
}

export interface ProjectManager {
  ID: number;
  Name: string;
  Type: string;
  TypeId: number;
}

export interface Technician {
  ID: number;
  Name: string;
  Type: string;
  TypeId: number;
}

export interface Salesperson {
  ID: number;
  Name: string;
  Position?: string;
  Availability?: string[];
  Address?: Address;
  DateOfHire?: string;
  DateOfBirth?: string;
  PrimaryContact?: PrimaryContact;
  DateCreated?: string;
  DateModified?: string;
  Archived?: boolean;
}

// Financial Types
export interface Total {
  ExTax: number;
  Tax: number;
  IncTax: number;
}

export interface Totals {
  MaterialsCost: number;
  ResourcesCost: number;
  MaterialsMarkup: number;
  ResourcesMarkup: number;
  Adjusted: number;
  MembershipDiscount: number;
  Discount: number;
  STCs: number;
  VEECs: number;
  GrossProfitLoss: number;
  GrossMargin: number;
  NettProfitLoss: number;
  NettMargin: number;
}

// Status and Archive Types
export interface Status {
  ID: number;
  Name: string;
  Color: string;
}

export interface ArchiveReason {
  ID: number;
  ArchiveReason: string;
}

// Quote Types
export interface ConvertedFromLead {
  ID: number;
  LeadName: string;
  DateCreated: string;
}

export interface Forecast {
  Year: number;
  Month: number;
  Percent: number;
}

export interface STC {
  STCsEligible: boolean;
  VEECsEligible: boolean;
  STCValue: number;
  VEECValue: number;
}

export interface Quote {
  ID: number;
  Customer?: Customer;
  AdditionalCustomers?: Customer[];
  CustomerContact?: CustomerContact;
  AdditionalContacts?: CustomerContact[];
  Site?: Site;
  SiteContact?: SiteContact;
  ConvertedFromLead?: ConvertedFromLead;
  Description?: string;
  Notes?: string;
  Type?: "Project" | "Service" | "Prepaid";
  Salesperson?: SalespersonRef;
  ProjectManager?: ProjectManager;
  Technicians?: Technician[];
  Technician?: Technician;
  DateIssued?: string;
  DateApproved?: string;
  DueDate?: string;
  ValidityDays?: number;
  OrderNo?: string;
  RequestNo?: string;
  Name?: string;
  IsClosed?: boolean;
  ArchiveReason?: ArchiveReason;
  Stage?: "InProgress" | "Complete" | "Approved";
  CustomerStage?: "New" | "Pending" | "Declined" | "Accepted";
  JobNo?: string;
  IsVariation?: boolean;
  LinkedJobID?: number;
  Forecast?: Forecast;
  Total?: Total;
  Totals?: Totals;
  Status?: Status;
  Tags?: string[];
  DateModified?: string;
  AutoAdjustStatus?: boolean;
  CustomFields?: Record<string, unknown>[];
  STC?: STC;
  // Added for route optimization
  coordinates?: [number, number]; // [longitude, latitude]
}

// UI State types
export interface RouteProgress {
  completed: number;
  total: number;
}

export type ViewMode = "map" | "list";

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Geocoding types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  address: string;
  coordinates: Coordinates | null;
}

// Route optimization types
export interface OptimizationOptions {
  strategy: "dueDate" | "value" | "distance" | "timeWindows";
  startLocation?: Coordinates;
  maxTravelTime?: number;
  preferHighValue?: boolean;
}

export interface OptimizedRoute {
  quotes: Quote[];
  totalDistance?: number;
  estimatedTime?: number;
  efficiency?: number;
}
