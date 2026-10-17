# ADR-001: Multi-Network Connection Bonding & Parallel Interface Dispatching

## Status

Accepted

## Context

Standard download managers and HTTP clients bind to the operating system's default network route (typically a single primary adapter like Wi-Fi or Ethernet). Users with secondary network connections (e.g., tethered 4G/5G mobile data via USB, secondary Ethernet, or auxiliary Wi-Fi adapters) cannot leverage combined bandwidth without expensive hardware routers or OS-level packet bonding drivers (such as LACP or MPTCP), which require server-side support.

## Decision

Pulse implements application-level network bonding in Node.js and Electron:

1. **Local Address Socket Binding**: Every outgoing HTTP range request socket is explicitly bound to a specific network interface's local IP address (`localAddress: interfaceIp`).
2. **Dynamic Block Scheduling**: Downloads are partitioned into uniform contiguous byte ranges (blocks). A centralized scheduler (`DownloadScheduler`) allocates available blocks to active streams across all user-selected interfaces according to real-time throughput.
3. **Speculative Hedging**: When a stream on an interface stalls or lags significantly behind peers, a hedge stream on an alternative, faster interface is dispatched to compete for the block. Whichever completes first wins, and the slower stream is discarded.
4. **Subnet Conflict Detection**: If two interfaces share the same IPv4 subnet, the app detects and warns the user that OS routing tables may route traffic through a single default gateway unless route metrics or binding options are configured.

## Consequences

### Positive

- Aggregated throughput across heterogeneous network connections (e.g. 50 Mbps Wi-Fi + 40 Mbps USB Tether = ~85-90 Mbps real transfer rate).
- Zero server-side changes required (works with any standard HTTP/1.1 or HTTP/2 server supporting `Range: bytes=...`).
- Automatic failover: if one interface disconnects, active streams are seamlessly rescheduled onto surviving interfaces.

### Negative / Trade-offs

- Multiple TCP handshakes and TLS sessions per download require increased file descriptor and socket allocation.
- Servers with strict per-IP rate limits or single-connection locks may reject parallel requests from disparate IP addresses for session-authenticated links.
