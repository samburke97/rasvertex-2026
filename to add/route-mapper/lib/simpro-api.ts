// lib/simpro-api.ts - Fixed import paths and proper types

import {
  SimproConfig,
  SimproAttachment,
  SimproAuthResponse,
  ApiResponse,
  SimproJob,
} from "./types";
import { validateJobId, validateCompanyId } from "./utils/validation";
import { logger } from "./utils/logger";

export class SimproClient {
  private config: SimproConfig;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor(config: SimproConfig) {
    this.config = config;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (
      !this.config.baseUrl ||
      !this.config.clientId ||
      !this.config.clientSecret
    ) {
      throw new Error("SimPRO configuration is incomplete");
    }
  }

  async authenticate(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Authentication failed: ${response.status} ${response.statusText}`
        );
      }

      const data: SimproAuthResponse = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);

      logger.info("SimPRO authentication successful");
    } catch (error) {
      logger.error("SimPRO authentication failed", error as Error);
      throw new Error("Failed to authenticate with SimPRO");
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (
      !this.accessToken ||
      !this.tokenExpiry ||
      this.tokenExpiry <= new Date()
    ) {
      await this.authenticate();
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    await this.ensureAuthenticated();

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      logger.error(errorMessage, { endpoint, status: response.status });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return { data, status: response.status };
  }

  async getJobAttachments(
    companyId: number,
    jobId: number,
    options: {
      pageSize?: number;
      page?: number;
      columns?: string[];
    } = {}
  ): Promise<SimproAttachment[]> {
    validateCompanyId(companyId);
    validateJobId(jobId);

    const params = new URLSearchParams();
    if (options.pageSize)
      params.append("pageSize", options.pageSize.toString());
    if (options.page) params.append("page", options.page.toString());
    if (options.columns) params.append("columns", options.columns.join(","));

    const endpoint = `/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/?${params}`;

    try {
      const response = await this.makeRequest<SimproAttachment[]>(endpoint);
      logger.info(
        `Retrieved ${response.data.length} attachments for job ${jobId}`
      );
      return response.data;
    } catch (error) {
      logger.error(
        `Failed to get attachments for job ${jobId}`,
        error as Error
      );
      throw new Error(
        `Failed to retrieve job attachments: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getJobAttachmentWithBase64(
    companyId: number,
    jobId: number,
    fileId: string
  ): Promise<SimproAttachment> {
    validateCompanyId(companyId);
    validateJobId(jobId);

    const endpoint = `/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/${fileId}?display=Base64`;

    try {
      const response = await this.makeRequest<SimproAttachment>(endpoint);
      return response.data;
    } catch (error) {
      logger.error(
        `Failed to get attachment ${fileId} with Base64`,
        error as Error
      );
      throw new Error(
        `Failed to retrieve attachment data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async getJobsForDate(date: string): Promise<SimproJob[]> {
    const endpoint = `/api/v1.0/companies/0/jobs?date=${date}`;
    const response = await this.makeRequest<SimproJob[]>(endpoint);
    return response.data;
  }

  async getSiteDetails(siteId: string): Promise<SimproJob> {
    const endpoint = `/api/v1.0/companies/0/sites/${siteId}`;
    const response = await this.makeRequest<SimproJob>(endpoint);
    return response.data;
  }

  async getTechnicians(): Promise<
    {
      ID: number;
      Name: string;
      Position?: string;
      Availability?: string[];
    }[]
  > {
    const endpoint = `/api/v1.0/companies/0/employees`;
    const response = await this.makeRequest<
      {
        ID: number;
        Name: string;
        Position?: string;
        Availability?: string[];
      }[]
    >(endpoint);
    return response.data;
  }
}
