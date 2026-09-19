import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import qs.Commons
import "GateLogic.js" as Gate

Item {
  id: root

  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null
  property var pluginRegistry: null

  property bool opened: false
  property bool confirming: false
  property real confirmPulse: 0
  property real irisPhase: 0
  property string selectedAction: ""
  property string receiptStatus: ""
  property string lastReceiptPath: ""
  property bool pendingClearOnSuccess: false
  property var gateState: Gate.emptyState()
  property var gate: Gate.emptyGate()
  property var risks: []
  property var pillars: []

  property color background: Color.menu.background
  property color foreground: Color.menu.text
  property color accent: Color.accent
  property color scrim: Color.menu.scrim
  property color border: Color.menu.border
  property string fontFamily: Style.font.menuFamily || Style.font.family
  readonly property string pluginId: (root.manifest && root.manifest.id) || "smf.aegis-gate"
  readonly property string homeDir: Quickshell.env("HOME")
  readonly property bool live: root.gate && root.gate.live === true
  readonly property string mode: root.live ? "live" : "demo"
  readonly property string modeChip: Gate.modeLabel(root.mode)
  readonly property string honestyText: Gate.honestyLine(root.gate)
  readonly property string recommendedText: Gate.recommendedLine(root.gate)
  readonly property color goColor: Gate.decisionColor("GO")
  readonly property color holdColor: Gate.decisionColor("HOLD")
  readonly property color noColor: Gate.decisionColor("NO")
  readonly property color selectedColor: Gate.decisionColor(root.selectedAction)

  function open(payloadJson) {
    root.gateState = Gate.resolveOpen(payloadJson, root.gateState)
    root.applyShowing()
    root.confirming = false
    root.confirmPulse = 0
    root.receiptStatus = ""
    root.opened = true
    root.persistPending()
    field.requestPaint()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.opened = false
    root.confirming = false
    root.confirmPulse = 0
  }

  function dismiss() {
    root.close()
    if (root.shell && typeof root.shell.hide === "function")
      root.shell.hide(root.pluginId)
  }

  function toggle() {
    if (root.opened) root.dismiss()
    else root.open("{}")
  }

  function pendingCount() {
    return String(Gate.pendingCount(root.gateState))
  }

  function applyShowing() {
    var showing = root.gateState && root.gateState.showing
      ? root.gateState.showing
      : Gate.emptyGate()
    root.gate = showing
    root.risks = showing.risks ? showing.risks.slice() : []
    root.selectedAction = Gate.defaultFocus(showing)
    root.pillars = Gate.pillarModel(root.selectedAction)
  }

  function focusAction(action) {
    var next = Gate.normalizeDecision(action)
    if (!next) return
    root.selectedAction = next
    root.pillars = Gate.pillarModel(next)
    field.requestPaint()
  }

  function persistPending() {
    var body = Gate.receiptLine(Gate.pendingPayload(root.gateState, new Date()))
    root.runWriter(pendingWriter, Gate.writeSpec("pending", root.homeDir, body))
  }

  function runWriter(proc, spec) {
    if (!proc || !spec || !spec.argv || !spec.argv.length) return
    proc.command = spec.argv
    proc.running = false
    proc.running = true
  }

  function confirmSelected() {
    if (root.confirming) return
    if (!Gate.canConfirm(root.selectedAction)) {
      root.receiptStatus = "select GO, HOLD, or NO first"
      return
    }
    root.confirming = true
    confirmAnim.restart()
  }

  function finishConfirm() {
    var result = Gate.confirm(root.gateState, root.selectedAction, new Date())
    if (result.error) {
      root.receiptStatus = result.error
      root.confirming = false
      root.pendingClearOnSuccess = false
      return
    }
    var line = Gate.receiptLine(result.receipt)
    var spec = Gate.writeSpec("receipts", root.homeDir, line)
    if (!Gate.writeReady(spec)) {
      root.receiptStatus = Gate.receiptFailureMessage()
      root.confirming = false
      root.pendingClearOnSuccess = false
      return
    }
    root.pendingClearOnSuccess = result.clearPending === true
    root.lastReceiptPath = spec.file
    root.receiptStatus = "writing " + spec.file
    root.runWriter(receiptWriter, spec)
  }

  function cssColor(c, a) {
    if (typeof c === "string") {
      var hex = c.replace("#", "")
      if (hex.length === 6) {
        return "rgba("
          + parseInt(hex.slice(0, 2), 16) + ","
          + parseInt(hex.slice(2, 4), 16) + ","
          + parseInt(hex.slice(4, 6), 16) + ","
          + a + ")"
      }
    }
    return "rgba("
      + Math.round(c.r * 255) + ","
      + Math.round(c.g * 255) + ","
      + Math.round(c.b * 255) + ","
      + a + ")"
  }

  function paintField(canvas) {
    var ctx = canvas.getContext("2d")
    if (!ctx) return
    var w = canvas.width
    var h = canvas.height
    ctx.reset()
    ctx.clearRect(0, 0, w, h)
    if (w < 8 || h < 8) return

    var cx = w * 0.5
    var cy = h * 0.38
    var maxR = Math.min(w, h) * 0.34
    var i
    var pulse = root.confirmPulse

    ctx.strokeStyle = cssColor(root.accent, 0.06)
    ctx.lineWidth = 1
    for (i = 0; i < 10; i++) {
      ctx.beginPath()
      ctx.moveTo(0, h * 0.08 + i * 36 + (root.irisPhase * 12) % 36)
      ctx.lineTo(w, h * 0.02 + i * 36 + (root.irisPhase * 12) % 36)
      ctx.stroke()
    }

    function strokeHex(radius, alpha, width) {
      var pts = Gate.hexPoints(cx, cy, radius, 0)
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (var p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y)
      ctx.closePath()
      ctx.lineWidth = width
      ctx.strokeStyle = cssColor(root.accent, alpha)
      ctx.stroke()
    }

    strokeHex(maxR * 1.16, 0.22, 1.6)
    strokeHex(maxR * 0.9, 0.48 + pulse * 0.22, 3)
    strokeHex(maxR * 0.64, 0.2, 1.4)

    var arcs = [
      { id: "GO", color: root.goColor, start: -Math.PI * 0.5 },
      { id: "HOLD", color: root.holdColor, start: Math.PI * 0.1667 },
      { id: "NO", color: root.noColor, start: Math.PI * 0.8333 }
    ]
    for (i = 0; i < arcs.length; i++) {
      var arc = arcs[i]
      var on = arc.id === root.selectedAction
      ctx.beginPath()
      ctx.lineWidth = on ? 10 + pulse * 7 : 5
      ctx.strokeStyle = cssColor(arc.color, on ? 0.95 : 0.5)
      ctx.arc(cx, cy, maxR * 0.98, arc.start + 0.07, arc.start + Math.PI * 0.666 - 0.07)
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.lineWidth = 1.4
    ctx.strokeStyle = cssColor(root.selectedColor, 0.35 + pulse * 0.4)
    ctx.arc(cx, cy, maxR * (0.22 + pulse * 0.04), 0, Math.PI * 2)
    ctx.stroke()
  }

  Process {
    id: receiptWriter
    running: false
    onExited: {
      if (!root.confirming) return
      if (receiptWriter.exitCode === 0) {
        if (root.pendingClearOnSuccess)
          root.gateState = Gate.clearPending(root.gateState)
        root.applyShowing()
        root.persistPending()
        root.receiptStatus = Gate.receiptStatusForWrite(true, root.lastReceiptPath)
        closeAfterWrite.restart()
      } else {
        root.receiptStatus = Gate.receiptFailureMessage()
        root.confirming = false
        root.pendingClearOnSuccess = false
      }
    }
  }

  Process {
    id: pendingWriter
    running: false
  }

  NumberAnimation on irisPhase {
    running: root.opened
    from: 0
    to: Math.PI * 2
    duration: 28000
    loops: Animation.Infinite
  }

  SequentialAnimation {
    id: confirmAnim
    NumberAnimation {
      target: root
      property: "confirmPulse"
      from: 0
      to: 1
      duration: 220
      easing.type: Easing.OutCubic
    }
    PauseAnimation { duration: 90 }
    ScriptAction { script: root.finishConfirm() }
  }

  Timer {
    id: closeAfterWrite
    interval: 220
    repeat: false
    onTriggered: root.dismiss()
  }

  Timer {
    interval: 40
    running: root.opened
    repeat: true
    onTriggered: field.requestPaint()
  }

  PanelWindow {
    id: panel
    visible: root.opened
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "smf-aegis-gate"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    Canvas {
      id: field
      anchors.fill: parent
      renderStrategy: Canvas.Cooperative
      onPaint: root.paintField(field)
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.dismiss()
    }

    Item {
      id: keyCatcher
      anchors.fill: parent
      focus: true

      Keys.priority: Keys.BeforeItem
      Keys.onPressed: function(event) {
        if (event.key === Qt.Key_Escape) {
          root.dismiss()
          event.accepted = true
        } else if (event.key === Qt.Key_1 || event.key === Qt.Key_G) {
          root.focusAction("GO")
          event.accepted = true
        } else if (event.key === Qt.Key_2 || event.key === Qt.Key_H) {
          root.focusAction("HOLD")
          event.accepted = true
        } else if (event.key === Qt.Key_3 || event.key === Qt.Key_N) {
          root.focusAction("NO")
          event.accepted = true
        } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
          root.confirmSelected()
          event.accepted = true
        } else if (event.key === Qt.Key_Left) {
          var left = Gate.decisionIndex(root.selectedAction)
          root.focusAction(Gate.DECISIONS[(left + 2) % 3])
          event.accepted = true
        } else if (event.key === Qt.Key_Right) {
          var right = Gate.decisionIndex(root.selectedAction)
          root.focusAction(Gate.DECISIONS[(right + 1) % 3])
          event.accepted = true
        }
      }
    }

    Rectangle {
      id: honesty
      anchors.top: parent.top
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.topMargin: Style.space(22)
      width: honestyRow.implicitWidth + Style.space(28)
      height: Style.space(38)
      radius: height / 2
      color: Util.alpha(root.background, 0.8)
      border.width: 1
      border.color: Util.alpha(root.live ? root.holdColor : root.accent, 0.62)
      z: 30

      Row {
        id: honestyRow
        anchors.centerIn: parent
        spacing: Style.space(10)

        Rectangle {
          width: chipLabel.implicitWidth + Style.space(16)
          height: Style.space(22)
          radius: height / 2
          color: Util.alpha(root.live ? root.holdColor : root.accent, root.live ? 0.28 : 0.16)
          border.width: 1
          border.color: Util.alpha(root.live ? root.holdColor : root.accent, 0.75)

          Text {
            id: chipLabel
            anchors.centerIn: parent
            text: root.modeChip
            color: root.live ? root.holdColor : root.accent
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            font.bold: true
            font.letterSpacing: 1.6
          }
        }

        Text {
          text: root.honestyText
          color: root.foreground
          opacity: 0.68
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          anchors.verticalCenter: parent.verticalCenter
        }
      }
    }

    Rectangle {
      id: core
      width: Math.min(Style.space(560), panel.width * 0.56)
      height: Math.min(Style.space(268), panel.height * 0.36)
      radius: Style.space(28)
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.verticalCenter: parent.verticalCenter
      anchors.verticalCenterOffset: -panel.height * 0.08
      color: Util.alpha(root.background, 0.82)
      border.width: 1
      border.color: Util.alpha(root.selectedColor, 0.45 + root.confirmPulse * 0.4)
      z: 20
      scale: 1 + root.confirmPulse * 0.018

      Behavior on scale { NumberAnimation { duration: 180; easing.type: Easing.OutCubic } }

      MouseArea { anchors.fill: parent; onClicked: {} }

      Column {
        anchors.fill: parent
        anchors.margins: Style.space(28)
        spacing: Style.space(10)

        Text {
          width: parent.width
          text: "AEGIS GATE"
          color: root.accent
          opacity: 0.78
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.letterSpacing: 3.2
          font.bold: true
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: String((root.gate && root.gate.title) || "")
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.heading
          font.bold: true
          wrapMode: Text.WordWrap
          horizontalAlignment: Text.AlignHCenter
          maximumLineCount: 2
          elide: Text.ElideRight
        }

        Text {
          width: parent.width
          textFormat: Text.PlainText
          text: String((root.gate && root.gate.reason) || "")
          color: root.foreground
          opacity: 0.72
          font.family: root.fontFamily
          font.pixelSize: Style.font.title
          wrapMode: Text.WordWrap
          horizontalAlignment: Text.AlignHCenter
          maximumLineCount: 3
          elide: Text.ElideRight
        }

        Flow {
          width: parent.width
          spacing: Style.space(8)

          Repeater {
            model: root.risks

            Rectangle {
              required property var modelData
              height: Style.space(26)
              width: chipText.implicitWidth + Style.space(16)
              radius: height / 2
              color: Util.alpha(root.holdColor, 0.12)
              border.width: 1
              border.color: Util.alpha(root.holdColor, 0.45)

              Text {
                id: chipText
                anchors.centerIn: parent
                textFormat: Text.PlainText
                text: String(modelData || "")
                color: root.foreground
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
              }
            }
          }
        }

        Text {
          width: parent.width
          text: Gate.sourceLabel(root.gate && root.gate.source, root.live)
          color: root.live ? root.holdColor : root.accent
          opacity: 0.72
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.letterSpacing: 1.1
          horizontalAlignment: Text.AlignHCenter
        }

        Text {
          width: parent.width
          text: root.recommendedText
          color: root.selectedAction ? root.selectedColor : Gate.decisionColor("")
          opacity: 0.8
          font.family: root.fontFamily
          font.pixelSize: Style.font.caption
          font.letterSpacing: 1.1
          horizontalAlignment: Text.AlignHCenter
        }
      }
    }

    Row {
      id: pillarRow
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.bottom: parent.bottom
      anchors.bottomMargin: Style.space(72)
      spacing: Style.space(22)
      z: 25

      Repeater {
        model: root.pillars

        Rectangle {
          id: pillar
          required property var modelData
          readonly property bool on: modelData && modelData.selected === true
          readonly property color tone: Gate.decisionColor(modelData && modelData.id)

          width: Math.min(Style.space(228), panel.width * 0.24)
          height: Style.space(196)
          radius: Style.space(18)
          color: Util.alpha(root.background, on ? 0.78 : 0.5)
          border.width: on ? 2 : 1
          border.color: Util.alpha(pillar.tone, on ? 0.9 : 0.28)
          scale: on ? 1.04 + root.confirmPulse * 0.06 : 1
          opacity: on ? 1 : 0.78

          Behavior on scale { NumberAnimation { duration: 160; easing.type: Easing.OutCubic } }

          Rectangle {
            anchors.top: parent.top
            anchors.left: parent.left
            anchors.right: parent.right
            height: Style.space(6)
            radius: Style.space(3)
            color: Util.alpha(pillar.tone, on ? 0.95 : 0.35)
          }

          Column {
            anchors.centerIn: parent
            spacing: Style.space(6)
            width: parent.width - Style.space(16)

            Text {
              width: parent.width
              text: String((modelData && modelData.label) || "")
              color: pillar.tone
              font.family: root.fontFamily
              font.pixelSize: Style.font.heading
              font.bold: true
              font.letterSpacing: 2.4
              horizontalAlignment: Text.AlignHCenter
            }

            Text {
              width: parent.width
              text: String((modelData && modelData.hint) || "")
              color: root.foreground
              opacity: 0.55
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              horizontalAlignment: Text.AlignHCenter
            }

            Text {
              width: parent.width
              text: String((modelData && modelData.key) || "")
              color: root.foreground
              opacity: 0.4
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              horizontalAlignment: Text.AlignHCenter
            }
          }

          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onEntered: root.focusAction(modelData && modelData.id)
            onClicked: {
              root.focusAction(modelData && modelData.id)
              root.confirmSelected()
            }
          }
        }
      }
    }

    Text {
      anchors.bottom: parent.bottom
      anchors.horizontalCenter: parent.horizontalCenter
      anchors.bottomMargin: Style.space(28)
      z: 30
      text: root.receiptStatus || "ESC close · 1/G GO · 2/H HOLD · 3/N NO · ENTER confirm"
      color: root.foreground
      opacity: root.receiptStatus ? 0.92 : 0.5
      font.family: root.fontFamily
      font.pixelSize: Style.font.caption
      font.letterSpacing: 1.1
    }
  }
}
