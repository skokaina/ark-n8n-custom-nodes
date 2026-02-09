{{/*
Expand the name of the chart.
*/}}
{{- define "ark-n8n.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "ark-n8n.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "ark-n8n.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "ark-n8n.labels" -}}
helm.sh/chart: {{ include "ark-n8n.chart" . }}
{{ include "ark-n8n.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "ark-n8n.selectorLabels" -}}
app.kubernetes.io/name: {{ include "ark-n8n.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Validate ARK controller version compatibility
*/}}
{{- define "ark-n8n.validateArkVersion" -}}
{{- if .Values.ark.supportedVersions }}
{{- $arkController := lookup "apps/v1" "Deployment" "ark-system" "ark-controller" }}
{{- if not $arkController }}
{{- fail "ARK controller not found in ark-system namespace. Please install ARK first: ark install" }}
{{- end }}
{{- $image := index $arkController.spec.template.spec.containers 0 "image" }}
{{- $version := regexFind ":[^:]+$" $image | trimPrefix ":" }}
{{- if or (not $version) (eq $version "latest") }}
{{- printf "WARNING: ARK controller version could not be determined from image: %s. Skipping version check." $image | print }}
{{- else }}
{{- $required := .Values.ark.supportedVersions }}
{{- $minVer := regexFind ">=([0-9.]+)" $required | trimPrefix ">=" }}
{{- $maxVer := regexFind "<([0-9.]+)" $required | trimPrefix "<" }}
{{- if and $minVer (semverCompare (printf "<%s" $minVer) $version) }}
{{- fail (printf "ARK controller version %s is below minimum required version %s" $version $minVer) }}
{{- end }}
{{- if and $maxVer (semverCompare (printf ">=%s" $maxVer) $version) }}
{{- fail (printf "ARK controller version %s is above maximum supported version %s" $version $maxVer) }}
{{- end }}
{{- printf "✓ ARK controller version %s is compatible (required: %s)" $version $required | print }}
{{- end }}
{{- end }}
{{- end }}
