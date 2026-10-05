// Emboldens the shaped wordmark (tools/wordmark.py) with a round-joined stroke and
// merges glyphs and stroke into plain filled outlines, so the logo files carry no
// strokes that scale differently from their fills.
//     python3 tools/wordmark.py EBGaramond-Italic.ttf | swift tools/outline.swift > source/wordmark.json
import CoreGraphics
import Foundation

let input = try JSONSerialization.jsonObject(with: FileHandle.standardInput.readDataToEndOfFile()) as! [String: Any]
let width = (input["embolden"] as! NSNumber).doubleValue

let glyphs = CGMutablePath()
for op in input["ops"] as! [[Any]] {
    let v = op.dropFirst().map { ($0 as! NSNumber).doubleValue }
    switch op[0] as! String {
    case "M": glyphs.move(to: CGPoint(x: v[0], y: v[1]))
    case "L": glyphs.addLine(to: CGPoint(x: v[0], y: v[1]))
    case "Q": glyphs.addQuadCurve(to: CGPoint(x: v[2], y: v[3]), control: CGPoint(x: v[0], y: v[1]))
    case "C": glyphs.addCurve(to: CGPoint(x: v[4], y: v[5]), control1: CGPoint(x: v[0], y: v[1]), control2: CGPoint(x: v[2], y: v[3]))
    default: glyphs.closeSubpath()
    }
}
let stroke = glyphs.copy(strokingWithWidth: width, lineCap: .round, lineJoin: .round, miterLimit: 10)
let outline = glyphs.union(stroke, using: .winding)

func n(_ v: CGFloat) -> String {
    let s = String(format: "%.1f", Double(v))
    return s.hasSuffix(".0") ? String(s.dropLast(2)) : (s == "-0" ? "0" : s)
}
func p(_ q: CGPoint) -> String { "\(n(q.x)) \(n(q.y))" }
var d: [String] = []
outline.applyWithBlock { e in
    let pts = e.pointee.points
    switch e.pointee.type {
    case .moveToPoint: d.append("M" + p(pts[0]))
    case .addLineToPoint: d.append("L" + p(pts[0]))
    case .addQuadCurveToPoint: d.append("Q" + p(pts[0]) + " " + p(pts[1]))
    case .addCurveToPoint: d.append("C" + p(pts[0]) + " " + p(pts[1]) + " " + p(pts[2]))
    case .closeSubpath: d.append("Z")
    @unknown default: break
    }
}
let box = outline.boundingBoxOfPath
let result: [String: Any] = [
    "text": input["text"]!, "embolden": width,
    "bbox": [box.minX, box.minY, box.maxX, box.maxY].map { Double(n($0))! },
    "d": d.joined(),
]
let json = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
FileHandle.standardOutput.write(json)
FileHandle.standardOutput.write("\n".data(using: .utf8)!)
