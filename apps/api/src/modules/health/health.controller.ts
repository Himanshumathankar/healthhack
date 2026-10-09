import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  health() {
    return {
      status: "ok",
      service: "healthhack-api",
      time: new Date().toISOString()
    };
  }

  @Get("ready")
  ready() {
    return {
      status: "ready"
    };
  }
}
