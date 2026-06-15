import type { PacketFrame } from "../types";

const T = {
  title: "802.11 \u6570\u636e\u5305\u89e3\u6790",
  waiting: "\u7b49\u5f85\u91c7\u96c6\u6570\u636e\u5305",
};

export function PacketTable({ frames }: { frames: PacketFrame[] }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <span>{T.title}</span>
        <small>{frames.length} frames</small>
      </div>
      <div className="packet-table-wrap">
        <table className="packet-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Type</th>
              <th>Length</th>
              <th>Signal</th>
            </tr>
          </thead>
          <tbody>
            {frames.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-cell">
                  {T.waiting}
                </td>
              </tr>
            ) : (
              frames.map((frame, index) => (
                <tr key={`${frame.time}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{frame.time.toFixed(2)}s</td>
                  <td>{frame.source}</td>
                  <td>{frame.destination}</td>
                  <td>
                    {frame.frameType} / {frame.subtype}
                  </td>
                  <td>{frame.length}</td>
                  <td>{frame.signal}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

